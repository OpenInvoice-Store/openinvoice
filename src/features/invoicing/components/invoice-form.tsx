'use client';

import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateInvoice, useInvoice, useUpdateInvoice } from '../hooks/use-invoices';
import { useCustomers } from '../hooks/use-customers';
import { useProducts } from '../hooks/use-products';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { formatCurrency } from '@/lib/format';

const invoiceItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be positive'),
  taxRate: z.number().min(0).max(100),
});

const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required'),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

export function InvoiceForm() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const isEditing = !!id;

  const { data: invoice, isLoading } = useInvoice(id || '');
  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'draft',
      notes: '',
      items: [{ productId: '', description: '', quantity: 1, price: 0, taxRate: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (invoice && isEditing) {
      form.reset({
        customerId: invoice.customerId,
        issueDate: invoice.issueDate.split('T')[0],
        dueDate: invoice.dueDate.split('T')[0],
        status: invoice.status,
        notes: invoice.notes || '',
        items: invoice.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          taxRate: item.taxRate,
        })),
      });
    }
  }, [invoice, isEditing, form]);

  const handleProductChange = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.productId`, productId);
      form.setValue(`items.${index}.description`, product.name);
      form.setValue(`items.${index}.price`, product.price);
      form.setValue(`items.${index}.taxRate`, product.taxRate);
    }
  };

  const calculateTotals = () => {
    const items = form.watch('items');
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = items.reduce(
      (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
      0
    );
    return { subtotal, tax, total: subtotal + tax };
  };

  const onSubmit = async (data: InvoiceFormData) => {
    try {
      if (isEditing && id) {
        await updateInvoice.mutateAsync({
          id,
          customerId: data.customerId,
          issueDate: data.issueDate,
          dueDate: data.dueDate,
          status: data.status,
          notes: data.notes,
          items: data.items.map((item) => ({
            productId: item.productId,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            taxRate: item.taxRate,
          })),
        } as Parameters<typeof updateInvoice.mutateAsync>[0]);
        toast.success('Invoice updated successfully');
      } else {
        await createInvoice.mutateAsync(data);
        toast.success('Invoice created successfully');
      }
      router.push('/dashboard/invoices');
    } catch (error) {
      toast.error('Failed to save invoice');
    }
  };

  if (isLoading && isEditing) {
    return <div className='p-4'>Loading...</div>;
  }

  const totals = calculateTotals();

  return (
    <Form form={form} onSubmit={form.handleSubmit(onSubmit)} className='space-y-6 max-w-4xl'>
        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='customerId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder='Select customer' />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {customers?.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='status'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || 'draft'}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='draft'>Draft</SelectItem>
                    <SelectItem value='sent'>Sent</SelectItem>
                    <SelectItem value='paid'>Paid</SelectItem>
                    <SelectItem value='overdue'>Overdue</SelectItem>
                    <SelectItem value='cancelled'>Cancelled</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <FormField
            control={form.control}
            name='issueDate'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Issue Date *</FormLabel>
                <FormControl>
                  <Input type='date' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='dueDate'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Due Date *</FormLabel>
                <FormControl>
                  <Input type='date' {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div>
          <div className='mb-2 flex items-center justify-between'>
            <label className='text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
              Items *
            </label>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => append({ productId: '', description: '', quantity: 1, price: 0, taxRate: 0 })}
            >
              <IconPlus className='mr-2 h-4 w-4' /> Add Item
            </Button>
          </div>

          <div className='space-y-4 rounded-md border p-4'>
            {fields.map((field, index) => (
              <div key={field.id} className='grid grid-cols-12 gap-2 items-end'>
                <FormField
                  control={form.control}
                  name={`items.${index}.productId`}
                  render={({ field }) => (
                    <FormItem className='col-span-3'>
                      <FormLabel>Product</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          handleProductChange(index, value);
                        }}
                        value={field.value || ''}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select product' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`items.${index}.description`}
                  render={({ field }) => (
                    <FormItem className='col-span-3'>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem className='col-span-2'>
                      <FormLabel>Qty</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`items.${index}.price`}
                  render={({ field }) => (
                    <FormItem className='col-span-2'>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`items.${index}.taxRate`}
                  render={({ field }) => (
                    <FormItem className='col-span-1'>
                      <FormLabel>Tax %</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => remove(index)}
                  className='col-span-1'
                >
                  <IconTrash className='h-4 w-4 text-destructive' />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className='ml-auto w-64 space-y-2 rounded-md border p-4'>
          <div className='flex justify-between'>
            <span>Subtotal:</span>
            <span>{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className='flex justify-between'>
            <span>Tax:</span>
            <span>{formatCurrency(totals.tax)}</span>
          </div>
          <div className='flex justify-between font-bold text-lg border-t pt-2'>
            <span>Total:</span>
            <span>{formatCurrency(totals.total)}</span>
          </div>
        </div>

        <FormField
          control={form.control}
          name='notes'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className='flex gap-2'>
          <Button type='submit' disabled={createInvoice.isPending || updateInvoice.isPending}>
            {isEditing ? 'Update' : 'Create'} Invoice
          </Button>
          <Button
            type='button'
            variant='outline'
            onClick={() => router.push('/dashboard/invoices')}
          >
            Cancel
          </Button>
        </div>
    </Form>
  );
}

