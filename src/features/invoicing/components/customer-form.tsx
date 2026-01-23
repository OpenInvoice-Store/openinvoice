'use client';

import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCreateCustomer, useCustomer, useUpdateCustomer } from '../hooks/use-customers';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

type CustomerFormData = z.infer<typeof customerSchema>;

export function CustomerForm() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const isEditing = !!id;

  const { data: customer, isLoading } = useCustomer(id || '');
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
    },
  });

  useEffect(() => {
    if (customer && isEditing) {
      form.reset({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
      });
    }
  }, [customer, isEditing, form]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (isEditing && id) {
        await updateCustomer.mutateAsync({
          id,
          ...data,
        });
        toast.success('Customer updated successfully');
      } else {
        await createCustomer.mutateAsync(data);
        toast.success('Customer created successfully');
      }
      router.push('/dashboard/customers');
    } catch (error) {
      toast.error('Failed to save customer');
    }
  };

  if (isLoading && isEditing) {
    return <div className='p-4'>Loading...</div>;
  }

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className='space-y-4 max-w-2xl'>
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
        name='email'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Email</FormLabel>
            <FormControl>
              <Input type='email' {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='phone'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name='address'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Address</FormLabel>
            <FormControl>
              <Textarea {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className='flex gap-2'>
        <Button type='submit' disabled={createCustomer.isPending || updateCustomer.isPending}>
          {isEditing ? 'Update' : 'Create'} Customer
        </Button>
        <Button
          type='button'
          variant='outline'
          onClick={() => router.push('/dashboard/customers')}
        >
          Cancel
        </Button>
      </div>
    </Form>
  );
}

