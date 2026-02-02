'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateProduct,
  useProduct,
  useUpdateProduct
} from '../hooks/use-products';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { FileUploader } from '@/components/file-uploader';
import Image from 'next/image';

// Helper function to check if URL is from an allowed domain
const isAllowedImageDomain = (url: string): boolean => {
  try {
    const urlObj = new URL(url);
    const allowedHostnames = [
      'api.slingacademy.com',
      'img.clerk.com',
      'clerk.com'
    ];

    // Check if hostname matches any allowed hostname or is a subdomain
    const matchesAllowedHostname = allowedHostnames.some(
      (hostname) =>
        urlObj.hostname === hostname || urlObj.hostname.endsWith(`.${hostname}`)
    );

    // Check if it's a DigitalOcean Spaces domain
    const isDigitalOceanSpaces = urlObj.hostname.endsWith(
      '.digitaloceanspaces.com'
    );

    return matchesAllowedHostname || isDigitalOceanSpaces;
  } catch {
    // If URL parsing fails, assume it's not allowed
    return false;
  }
};

const productSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  taxRate: z.number().min(0).max(100),
  unit: z.string().min(1, 'Unit is required'),
  imageUrl: z.string().optional()
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductForm() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const isEditing = !!id;

  const { data: product, isLoading } = useProduct(id || '');
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      taxRate: 0,
      unit: 'piece',
      imageUrl: ''
    }
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (product && isEditing) {
      form.reset({
        name: product.name,
        description: product.description || '',
        price: product.price,
        taxRate: product.taxRate,
        unit: product.unit,
        imageUrl: product.imageUrl || ''
      });
    }
  }, [product, isEditing, form]);

  const handleImageUpload = async (files: File[]) => {
    if (files.length === 0) return;

    setUploading(true);
    try {
      const file = files[0];
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      form.setValue('imageUrl', data.url);
      toast.success('Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    try {
      if (isEditing && id) {
        await updateProduct.mutateAsync({
          id,
          ...data
        });
        toast.success('Product updated successfully');
      } else {
        await createProduct.mutateAsync(data);
        toast.success('Product created successfully');
      }
      router.push('/dashboard/products');
    } catch (error) {
      toast.error('Failed to save product');
    }
  };

  if (isLoading && isEditing) {
    return <div className='p-4'>Loading...</div>;
  }

  return (
    <Form
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      className='max-w-2xl space-y-4'
    >
      <FormField
        control={form.control}
        name='name'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Name *</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='description'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className='grid grid-cols-2 gap-4'>
        <FormField
          control={form.control}
          name='price'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Price *</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  step='0.01'
                  {...field}
                  onChange={(e) =>
                    field.onChange(parseFloat(e.target.value) || 0)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='taxRate'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tax Rate (%)</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  step='0.01'
                  {...field}
                  onChange={(e) =>
                    field.onChange(parseFloat(e.target.value) || 0)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name='unit'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Unit *</FormLabel>
            <FormControl>
              <Input {...field} placeholder='piece, hour, kg, etc.' />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='imageUrl'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Product Image</FormLabel>
            <FormControl>
              <div className='space-y-4'>
                {field.value && (
                  <div className='relative h-32 w-32 overflow-hidden rounded-lg border'>
                    {isAllowedImageDomain(field.value) ? (
                      <Image
                        src={field.value}
                        alt='Product image'
                        fill
                        className='object-cover'
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={field.value}
                        alt='Product image'
                        className='h-full w-full object-cover'
                      />
                    )}
                    <Button
                      type='button'
                      variant='destructive'
                      size='sm'
                      className='absolute top-1 right-1'
                      onClick={() => {
                        field.onChange('');
                        form.setValue('imageUrl', '');
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                )}
                <FileUploader
                  value={[]}
                  onUpload={handleImageUpload}
                  accept={{ 'image/*': [] }}
                  maxSize={5 * 1024 * 1024} // 5MB
                  maxFiles={1}
                  disabled={uploading}
                />
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className='flex gap-2'>
        <Button
          type='submit'
          disabled={createProduct.isPending || updateProduct.isPending}
        >
          {isEditing ? 'Update' : 'Create'} Product
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.push('/dashboard/products')}
        >
          Cancel
        </Button>
      </div>
    </Form>
  );
}
