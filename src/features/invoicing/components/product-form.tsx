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
  FormMessage,
  FormDescription
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
import { useEffect, useState, useCallback } from 'react';
import { FileUploader } from '@/components/file-uploader';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  PRODUCT_TYPES,
  getProductTypeConfig,
  type ProductVariantAttribute
} from '@/config/product-types';

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
  imageUrl: z.string().optional(),
  productType: z.string().default('generic'),
  variants: z.record(z.string(), z.any()).optional().default({}) // Variant attributes as key-value pairs
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
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      taxRate: 0,
      unit: 'piece',
      imageUrl: '',
      productType: 'generic',
      variants: {}
    }
  });

  const selectedProductType = form.watch('productType') || 'generic';
  const productTypeConfig = getProductTypeConfig(selectedProductType);

  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);

  // Check if AI is enabled
  const { data: aiSettings } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/ai');
      if (!response.ok) {
        return { aiEnabled: false };
      }
      return response.json();
    }
  });

  useEffect(() => {
    if (aiSettings) {
      setAiEnabled(aiSettings.aiEnabled || false);
    }
  }, [aiSettings]);

  useEffect(() => {
    if (product && isEditing) {
      // Parse variants JSON if it exists
      let variants = {};
      if ((product as any).variants) {
        try {
          variants =
            typeof (product as any).variants === 'string'
              ? JSON.parse((product as any).variants)
              : (product as any).variants;
        } catch (e) {
          console.error('Error parsing variants:', e);
        }
      }

      form.reset({
        name: product.name,
        description: product.description || '',
        price: product.price,
        taxRate: product.taxRate,
        unit: product.unit,
        imageUrl: product.imageUrl || '',
        productType: (product as any).productType || 'generic',
        variants: variants
      });
    }
  }, [product, isEditing, form]);

  const handleImageUpload = useCallback(
    async (files: File[]) => {
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
        const imageUrl = data.url;
        form.setValue('imageUrl', imageUrl);
        toast.success('Image uploaded successfully');

        // If AI is enabled and not editing, analyze the image
        if (aiEnabled && !isEditing) {
          setAnalyzing(true);
          try {
            const analyzeResponse = await fetch('/api/products/analyze-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageUrl })
            });

            if (analyzeResponse.ok) {
              const analysis = await analyzeResponse.json();

              console.log('AI Analysis result:', analysis); // Debug log

              // Populate form fields with AI-extracted data
              if (analysis.name) {
                form.setValue('name', analysis.name, { shouldValidate: true });
              }
              if (analysis.description) {
                form.setValue('description', analysis.description, {
                  shouldValidate: true
                });
              }
              // Handle price - check if it's a valid number (including 0)
              // Note: If price is undefined, it means AI couldn't find a price (user should fill manually)
              if (analysis.price !== null && analysis.price !== undefined) {
                const priceValue =
                  typeof analysis.price === 'string'
                    ? parseFloat(analysis.price.replace(/[^0-9.]/g, ''))
                    : Number(analysis.price);

                if (!isNaN(priceValue) && priceValue >= 0) {
                  console.log(
                    'Setting price:',
                    priceValue,
                    'from analysis:',
                    analysis.price
                  );
                  form.setValue('price', priceValue, {
                    shouldValidate: true,
                    shouldDirty: true
                  });
                  // Force a re-render by triggering change
                  form.trigger('price');
                } else {
                  console.log(
                    'Invalid price value:',
                    analysis.price,
                    'parsed as:',
                    priceValue
                  );
                }
              } else {
                console.log(
                  'Price not found in analysis - AI could not detect price in image. Please enter manually.'
                );
                // Don't show error toast - this is expected if price isn't visible in image
              }
              if (analysis.unit) {
                form.setValue('unit', analysis.unit, { shouldValidate: true });
              }
              if (
                analysis.taxRate !== null &&
                analysis.taxRate !== undefined &&
                !isNaN(Number(analysis.taxRate))
              ) {
                const taxValue = Number(analysis.taxRate);
                if (taxValue >= 0 && taxValue <= 100) {
                  form.setValue('taxRate', taxValue, { shouldValidate: true });
                }
              }
              // Handle product type
              if (analysis.productType) {
                form.setValue('productType', analysis.productType, {
                  shouldValidate: true
                });
                console.log('Setting product type:', analysis.productType);
              }
              // Handle variants
              if (
                analysis.variants &&
                Object.keys(analysis.variants).length > 0
              ) {
                // Merge with existing variants
                const currentVariants = form.getValues('variants') || {};
                const mergedVariants = {
                  ...currentVariants,
                  ...analysis.variants
                };
                form.setValue('variants', mergedVariants, {
                  shouldValidate: true
                });
                console.log('Setting variants:', mergedVariants);
              }

              toast.success(
                'Product details extracted successfully! Review and edit as needed.'
              );
            } else {
              const errorData = await analyzeResponse.json();
              // Don't show error if AI is not configured - just allow manual entry
              if (!errorData.error?.includes('not configured')) {
                toast.error(errorData.error || 'Failed to analyze image');
              }
            }
          } catch (error) {
            console.error('Error analyzing image:', error);
            // Don't show error toast - allow manual entry
          } finally {
            setAnalyzing(false);
          }
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        toast.error('Failed to upload image');
      } finally {
        setUploading(false);
      }
    },
    [aiEnabled, isEditing, form]
  );

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste if we're not uploading or analyzing
      if (uploading || analyzing) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      // Look for image in clipboard
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();

          const blob = item.getAsFile();
          if (!blob) return;

          // Convert blob to File
          const file = new File([blob], `pasted-image-${Date.now()}.png`, {
            type: blob.type || 'image/png'
          });

          toast.info('Image pasted! Uploading...');
          await handleImageUpload([file]);
          break;
        }
      }
    };

    // Add paste event listener
    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [uploading, analyzing, handleImageUpload]);

  const onSubmit = async (data: ProductFormData) => {
    try {
      // Convert variants object to JSON string for storage
      const submitData = {
        ...data,
        variants:
          data.variants && Object.keys(data.variants).length > 0
            ? JSON.stringify(data.variants)
            : null
      };

      if (isEditing && id) {
        await updateProduct.mutateAsync({
          id,
          ...submitData
        });
        toast.success('Product updated successfully');
      } else {
        await createProduct.mutateAsync(submitData);
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

  const imageUrl = form.watch('imageUrl');
  const showImageFirst = !isEditing && !imageUrl;

  return (
    <Form
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      className='max-w-2xl space-y-4'
    >
      {/* Show image upload first for new products */}
      {showImageFirst && (
        <div className='space-y-4'>
          <div>
            <h3 className='mb-2 text-lg font-semibold'>Upload Product Image</h3>
            {aiEnabled && (
              <Alert className='mb-4'>
                <Sparkles className='h-4 w-4' />
                <AlertDescription>
                  AI is enabled! After uploading an image (or pasting with
                  Ctrl+V/Cmd+V), we'll automatically extract product details for
                  you.
                </AlertDescription>
              </Alert>
            )}
            {!aiEnabled && (
              <Alert className='mb-4 border'>
                <AlertDescription>
                  <strong>Tip:</strong> Configure AI in settings to
                  automatically extract product details from images. You can
                  also paste images directly (Ctrl+V/Cmd+V).
                </AlertDescription>
              </Alert>
            )}
          </div>
          <FormField
            control={form.control}
            name='imageUrl'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Product Image {aiEnabled && '(AI will analyze after upload)'}
                </FormLabel>
                <FormControl>
                  <div className='space-y-4'>
                    {analyzing && (
                      <Alert>
                        <Loader2 className='h-4 w-4 animate-spin' />
                        <AlertDescription>
                          AI is analyzing the image and extracting product
                          details...
                        </AlertDescription>
                      </Alert>
                    )}
                    <FileUploader
                      value={[]}
                      onUpload={handleImageUpload}
                      accept={{ 'image/*': [] }}
                      maxSize={5 * 1024 * 1024} // 5MB
                      maxFiles={1}
                      disabled={uploading || analyzing}
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Upload a product image or paste one directly (Ctrl+V/Cmd+V).{' '}
                  {aiEnabled
                    ? 'AI will automatically extract details.'
                    : 'You can add details manually below.'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {imageUrl && (
            <Alert variant='default'>
              <AlertDescription>
                Image uploaded!{' '}
                {aiEnabled
                  ? 'AI analysis complete. Review the details below and edit as needed.'
                  : 'Please fill in the product details below.'}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Product Details Section */}
      <div className={showImageFirst && !imageUrl ? '' : ''}>
        <div className='mb-4'>
          <h3 className='text-lg font-semibold'>Product Details</h3>
          {showImageFirst && !imageUrl && (
            <p className='text-muted-foreground mt-1 text-sm'>
              Upload an image to enable AI analysis, or fill in the details
              manually below
            </p>
          )}
        </div>

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

        {/* Product Type Selection */}
        <FormField
          control={form.control}
          name='productType'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select product type' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {PRODUCT_TYPES.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Select the product type to enable variant fields (size, color,
                etc.)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Variant Fields - Dynamically shown based on product type */}
        {productTypeConfig && productTypeConfig.variants.length > 0 && (
          <div className='space-y-4 rounded-lg border p-4'>
            <h4 className='text-sm font-semibold'>Product Variants</h4>
            {productTypeConfig.variants.map(
              (variant: ProductVariantAttribute) => (
                <FormField
                  key={variant.name}
                  control={form.control}
                  name={`variants.${variant.name}` as any}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {variant.label}
                        {variant.required && ' *'}
                      </FormLabel>
                      <FormControl>
                        {variant.type === 'select' && variant.options ? (
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ''}
                          >
                            <SelectTrigger>
                              <SelectValue
                                placeholder={`Select ${variant.label.toLowerCase()}`}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {variant.options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            {...field}
                            type={variant.type === 'number' ? 'number' : 'text'}
                            placeholder={variant.placeholder}
                            value={field.value || ''}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )
            )}
          </div>
        )}

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
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || 0)
                    }
                    onBlur={field.onBlur}
                    name={field.name}
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

        {/* Image field - shown after initial upload or when editing */}
        {!showImageFirst && (
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
                      disabled={uploading || analyzing}
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <div className='flex gap-2'>
        <Button
          type='submit'
          disabled={
            createProduct.isPending || updateProduct.isPending || analyzing
          }
        >
          {createProduct.isPending || updateProduct.isPending ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              {isEditing ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>{isEditing ? 'Update' : 'Create'} Product</>
          )}
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
