'use client';

import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  useCreateRecurringInvoice,
  useRecurringInvoice,
  useUpdateRecurringInvoice,
  type RecurringInvoiceTemplateItem
} from '../hooks/use-recurring-invoices';
import { useCustomers } from '../hooks/use-customers';
import { useProducts } from '../hooks/use-products';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { formatCurrency } from '@/lib/format';
import { CURRENCIES } from '@/lib/currency';
import { useBrandingSettings } from '../hooks/use-branding';

const recurringInvoiceItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be positive'),
  taxRate: z.number().min(0).max(100)
});

const recurringInvoiceSchema = z
  .object({
    name: z.string().min(1, 'Template name is required'),
    customerId: z.string().min(1, 'Customer is required'),
    frequency: z.enum([
      'daily',
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'yearly',
      'custom'
    ]),
    interval: z.number().min(1),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional().nullable(),
    templateItems: z
      .array(recurringInvoiceItemSchema)
      .min(1, 'At least one item is required'),
    templateNotes: z.string().optional(),
    daysUntilDue: z.number().min(1),
    autoSendEmail: z.boolean(),
    isUsageBased: z.boolean(),
    usageUnit: z.string().optional().nullable(),
    currency: z.string().min(3).max(3).optional()
  })
  .superRefine((data, ctx) => {
    // If usage-based, usage unit is required
    if (data.isUsageBased && !data.usageUnit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Usage unit is required when usage-based billing is enabled',
        path: ['usageUnit']
      });
    }
  });

type RecurringInvoiceFormData = z.infer<typeof recurringInvoiceSchema>;

export function RecurringInvoiceForm() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const isEditing = !!id;

  const { data: template, isLoading } = useRecurringInvoice(id || '');
  const { data: customers } = useCustomers();
  const { data: products } = useProducts();
  const { data: branding } = useBrandingSettings();
  const createRecurringInvoice = useCreateRecurringInvoice();
  const updateRecurringInvoice = useUpdateRecurringInvoice();

  const form = useForm<RecurringInvoiceFormData>({
    resolver: zodResolver(recurringInvoiceSchema),
    defaultValues: {
      name: '',
      customerId: '',
      frequency: 'monthly',
      interval: 1,
      startDate: new Date().toISOString().split('T')[0],
      endDate: null,
      templateItems: [
        { productId: '', description: '', quantity: 1, price: 0, taxRate: 0 }
      ],
      templateNotes: '',
      daysUntilDue: 30,
      autoSendEmail: true,
      isUsageBased: false,
      usageUnit: null,
      currency: branding?.defaultCurrency || 'USD'
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'templateItems'
  });

  useEffect(() => {
    if (template && isEditing) {
      const items = JSON.parse(
        template.templateItems
      ) as RecurringInvoiceTemplateItem[];
      // Get currency from template or organization default
      const templateCurrency =
        (template as any).currency ||
        (template as any).organization?.defaultCurrency ||
        branding?.defaultCurrency ||
        'USD';
      form.reset({
        name: template.name,
        customerId: template.customerId,
        frequency: template.frequency,
        interval: template.interval,
        startDate: template.startDate.split('T')[0],
        endDate: template.endDate ? template.endDate.split('T')[0] : null,
        templateItems: items,
        templateNotes: template.templateNotes || '',
        daysUntilDue: template.daysUntilDue,
        autoSendEmail: template.autoSendEmail,
        isUsageBased: template.isUsageBased || false,
        usageUnit: template.usageUnit || null,
        currency: templateCurrency
      });
    }
  }, [template, isEditing, form, branding]);

  const handleProductChange = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue(`templateItems.${index}.productId`, productId);
      form.setValue(`templateItems.${index}.description`, product.name);
      form.setValue(`templateItems.${index}.price`, product.price);
      form.setValue(`templateItems.${index}.taxRate`, product.taxRate);
    }
  };

  const calculateTotals = () => {
    const items = form.watch('templateItems');
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

  const onSubmit = async (data: RecurringInvoiceFormData) => {
    try {
      if (isEditing && id) {
        await updateRecurringInvoice.mutateAsync({
          id,
          ...data
        });
        toast.success('Recurring invoice template updated successfully');
      } else {
        await createRecurringInvoice.mutateAsync(data);
        toast.success('Recurring invoice template created successfully');
      }
      router.push('/dashboard/recurring-invoices');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to save recurring invoice template'
      );
    }
  };

  if (isLoading && isEditing) {
    return <div className='p-4'>Loading...</div>;
  }

  const totals = calculateTotals();
  const frequency = form.watch('frequency');

  return (
    <Form
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      className='max-w-4xl space-y-6'
    >
      <div className='grid grid-cols-1 gap-4'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Template Name *</FormLabel>
              <FormControl>
                <Input
                  placeholder='e.g., Monthly Subscription - Customer X'
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A descriptive name for this recurring invoice template
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

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
          name='frequency'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Frequency *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='daily'>Daily</SelectItem>
                  <SelectItem value='weekly'>Weekly</SelectItem>
                  <SelectItem value='biweekly'>Bi-weekly</SelectItem>
                  <SelectItem value='monthly'>Monthly</SelectItem>
                  <SelectItem value='quarterly'>Quarterly</SelectItem>
                  <SelectItem value='yearly'>Yearly</SelectItem>
                  <SelectItem value='custom'>Custom</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {frequency === 'custom' && (
        <FormField
          control={form.control}
          name='interval'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Interval (days) *</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={1}
                  {...field}
                  onChange={(e) =>
                    field.onChange(parseInt(e.target.value) || 1)
                  }
                />
              </FormControl>
              <FormDescription>
                Number of days between each invoice generation
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      <div className='grid grid-cols-2 gap-4'>
        <FormField
          control={form.control}
          name='startDate'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Start Date *</FormLabel>
              <FormControl>
                <Input type='date' {...field} />
              </FormControl>
              <FormDescription>
                When to start generating invoices
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='endDate'
          render={({ field }) => (
            <FormItem>
              <FormLabel>End Date (Optional)</FormLabel>
              <FormControl>
                <Input
                  type='date'
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                />
              </FormControl>
              <FormDescription>
                Leave empty for never-ending subscription
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className='grid grid-cols-2 gap-4'>
        <FormField
          control={form.control}
          name='daysUntilDue'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Days Until Due *</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  min={1}
                  {...field}
                  onChange={(e) =>
                    field.onChange(parseInt(e.target.value) || 30)
                  }
                />
              </FormControl>
              <FormDescription>
                Number of days from issue date to due date
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='currency'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value || branding?.defaultCurrency || 'USD'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select currency' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name} ({currency.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                Currency for invoices generated from this template
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className='grid grid-cols-1 gap-4'>
        <FormField
          control={form.control}
          name='autoSendEmail'
          render={({ field }) => (
            <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className='space-y-1 leading-none'>
                <FormLabel>Automatically send email</FormLabel>
                <FormDescription>
                  Send invoice email automatically when generated
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
      </div>

      <div className='space-y-4 rounded-lg border p-4'>
        <FormField
          control={form.control}
          name='isUsageBased'
          render={({ field }) => (
            <FormItem className='flex flex-row items-start space-y-0 space-x-3'>
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className='space-y-1 leading-none'>
                <FormLabel>Usage-based billing</FormLabel>
                <FormDescription>
                  Enable usage-based billing. Invoice amounts will be calculated
                  based on recorded usage data.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {form.watch('isUsageBased') && (
          <FormField
            control={form.control}
            name='usageUnit'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Usage Unit *</FormLabel>
                <FormControl>
                  <Input
                    placeholder='e.g., GB, API calls, hours, minutes'
                    {...field}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormDescription>
                  Unit of measurement for usage (e.g., "GB" for storage, "API
                  calls" for API usage)
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
      </div>

      <div>
        <div className='mb-2 flex items-center justify-between'>
          <label className='text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
            Invoice Items *
          </label>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() =>
              append({
                productId: '',
                description: '',
                quantity: 1,
                price: 0,
                taxRate: 0
              })
            }
          >
            <IconPlus className='mr-2 h-4 w-4' /> Add Item
          </Button>
        </div>

        <div className='space-y-4'>
          {fields.map((field, index) => (
            <div
              key={field.id}
              className='grid grid-cols-12 items-end gap-2 rounded-lg border p-4'
            >
              <div className='col-span-12 md:col-span-4'>
                <FormField
                  control={form.control}
                  name={`templateItems.${index}.productId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Product</FormLabel>
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
              </div>

              <div className='col-span-12 md:col-span-4'>
                <FormField
                  control={form.control}
                  name={`templateItems.${index}.description`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Description</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='col-span-6 md:col-span-1'>
                <FormField
                  control={form.control}
                  name={`templateItems.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Qty</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={1}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className='col-span-6 md:col-span-1'>
                <FormField
                  control={form.control}
                  name={`templateItems.${index}.price`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Price</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          min={0}
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

              <div className='col-span-6 md:col-span-1'>
                <FormField
                  control={form.control}
                  name={`templateItems.${index}.taxRate`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className='text-xs'>Tax %</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          min={0}
                          max={100}
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

              <div className='col-span-6 flex items-center justify-end md:col-span-1'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  <IconTrash className='text-destructive h-4 w-4' />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className='mt-4 flex justify-end space-x-4 border-t pt-4'>
          <div className='text-right'>
            <div className='text-muted-foreground text-sm'>
              Subtotal:{' '}
              {formatCurrency(totals.subtotal, form.watch('currency') || 'USD')}
            </div>
            <div className='text-muted-foreground text-sm'>
              Tax: {formatCurrency(totals.tax, form.watch('currency') || 'USD')}
            </div>
            <div className='text-lg font-semibold'>
              Total:{' '}
              {formatCurrency(totals.total, form.watch('currency') || 'USD')}
            </div>
          </div>
        </div>
      </div>

      <FormField
        control={form.control}
        name='templateNotes'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Notes (Optional)</FormLabel>
            <FormControl>
              <Textarea
                placeholder='Additional notes to include in each generated invoice...'
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className='flex justify-end space-x-4'>
        <Button type='button' variant='outline' onClick={() => router.back()}>
          Cancel
        </Button>
        <Button
          type='submit'
          disabled={
            createRecurringInvoice.isPending || updateRecurringInvoice.isPending
          }
        >
          {isEditing ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </Form>
  );
}
