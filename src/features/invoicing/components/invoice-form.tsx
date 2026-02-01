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
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  useCreateInvoice,
  useInvoice,
  useUpdateInvoice
} from '../hooks/use-invoices';
import { useCustomers } from '../hooks/use-customers';
import { useProducts } from '../hooks/use-products';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { IconTrash, IconPlus } from '@tabler/icons-react';
import { formatCurrency } from '@/lib/format';
import { useBrandingSettings } from '../hooks/use-branding';
import { useInvoiceTemplates } from '../hooks/use-templates';
import { useTaxProfiles } from '../hooks/use-tax-profiles';
import { CURRENCIES } from '@/lib/currency';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Loader2 } from 'lucide-react';
import { useState, useCallback } from 'react';

const invoiceItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  description: z.string().min(1, 'Description is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  price: z.number().min(0, 'Price must be positive'),
  taxRate: z.number().min(0).max(100)
});

const invoiceSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  issueDate: z.string().min(1, 'Issue date is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
  templateId: z.string().optional().nullable(),
  currency: z.string().min(3).max(3).optional(),
  items: z.array(invoiceItemSchema).min(1, 'At least one item is required')
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
  const { data: branding } = useBrandingSettings();
  const { data: templates = [] } = useInvoiceTemplates();
  const { data: taxProfiles = [] } = useTaxProfiles();

  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice();

  // State for tax calculation
  const [selectedTaxProfileId, setSelectedTaxProfileId] = useState<
    string | null
  >(null);
  const [taxCalculationResult, setTaxCalculationResult] = useState<{
    taxAmount: number;
    taxes: Array<{
      name: string;
      rate: number;
      amount: number;
      authority?: string;
    }>;
    subtotal: number;
    total: number;
  } | null>(null);
  const [isCalculatingTax, setIsCalculatingTax] = useState(false);

  const defaultTemplate = templates.find((t) => t.isDefault);

  const form = useForm<InvoiceFormData>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: '',
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
      status: 'draft',
      notes: '',
      templateId: defaultTemplate?.id || null,
      currency: branding?.defaultCurrency || 'USD',
      items: [
        { productId: '', description: '', quantity: 1, price: 0, taxRate: 0 }
      ]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items'
  });

  useEffect(() => {
    if (invoice && isEditing) {
      // Get currency from invoice or organization default
      const invoiceCurrency =
        (invoice as any).currency ||
        (invoice as any).organization?.defaultCurrency ||
        branding?.defaultCurrency ||
        'USD';

      // Load existing tax profile if available
      const invoiceTaxProfileId = (invoice as any).taxProfileId || null;
      setSelectedTaxProfileId(invoiceTaxProfileId);

      form.reset({
        customerId: invoice.customerId,
        issueDate: invoice.issueDate.split('T')[0],
        dueDate: invoice.dueDate.split('T')[0],
        status: invoice.status,
        notes: invoice.notes || '',
        templateId: (invoice as any).templateId || null,
        currency: invoiceCurrency,
        items: invoice.items.map((item) => ({
          productId: item.productId,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
          taxRate: item.taxRate
        }))
      });

      // Calculate tax if tax profile exists
      if (invoiceTaxProfileId) {
        setTimeout(() => {
          calculateTax();
        }, 100);
      }
    }
  }, [invoice, isEditing, form, branding]);

  const handleProductChange = (index: number, productId: string) => {
    const product = products?.find((p) => p.id === productId);
    if (product) {
      form.setValue(`items.${index}.productId`, productId);
      form.setValue(`items.${index}.description`, product.name);
      form.setValue(`items.${index}.price`, product.price);
      form.setValue(`items.${index}.taxRate`, product.taxRate);
    }
  };

  // Calculate tax using custom tax system
  const calculateTax = useCallback(async () => {
    const items = form.watch('items');
    const customerId = form.watch('customerId');

    if (
      !selectedTaxProfileId ||
      selectedTaxProfileId === 'none' ||
      !customerId ||
      items.length === 0
    ) {
      setTaxCalculationResult(null);
      return;
    }

    setIsCalculatingTax(true);
    try {
      const response = await fetch('/api/tax/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            price: item.price,
            quantity: item.quantity
          })),
          customerId,
          taxProfileId:
            selectedTaxProfileId === 'none' ? null : selectedTaxProfileId
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTaxCalculationResult({
          taxAmount: data.taxAmount || 0,
          taxes: data.taxes || [],
          subtotal: data.subtotal || 0,
          total: data.total || 0
        });
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to calculate tax');
        setTaxCalculationResult(null);
      }
    } catch (error) {
      console.error('Error calculating tax:', error);
      toast.error('Failed to calculate tax');
      setTaxCalculationResult(null);
    } finally {
      setIsCalculatingTax(false);
    }
  }, [selectedTaxProfileId, form, branding]);

  // Recalculate tax when items, customer, or tax profile changes
  useEffect(() => {
    if (
      selectedTaxProfileId &&
      selectedTaxProfileId !== 'none' &&
      form.watch('customerId')
    ) {
      const timeoutId = setTimeout(() => {
        calculateTax();
      }, 500); // Debounce for 500ms

      return () => clearTimeout(timeoutId);
    } else {
      setTaxCalculationResult(null);
    }
  }, [
    form.watch('items'),
    form.watch('customerId'),
    selectedTaxProfileId,
    calculateTax
  ]);

  const calculateTotals = () => {
    const items = form.watch('items');
    const subtotal = items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    // Manual tax (from taxRate field)
    const manualTax = items.reduce(
      (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
      0
    );
    // Custom tax (from tax profile)
    const customTax = taxCalculationResult?.taxAmount || 0;
    const totalTax = manualTax + customTax;
    return {
      subtotal,
      manualTax,
      customTax,
      totalTax,
      total: subtotal + totalTax
    };
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
          templateId: data.templateId || undefined,
          currency: data.currency,
          taxProfileId:
            selectedTaxProfileId && selectedTaxProfileId !== 'none'
              ? selectedTaxProfileId
              : undefined,
          items: data.items.map(
            (
              item
            ): {
              productId: string;
              description: string;
              quantity: number;
              price: number;
              taxRate?: number;
            } => ({
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              price: item.price,
              ...(item.taxRate !== undefined && { taxRate: item.taxRate })
            })
          )
        });

        toast.success('Invoice updated successfully');
      } else {
        await createInvoice.mutateAsync({
          ...data,
          templateId: data.templateId || undefined,
          currency: data.currency,
          taxProfileId:
            selectedTaxProfileId && selectedTaxProfileId !== 'none'
              ? selectedTaxProfileId
              : undefined
        });

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
    <Form
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      className='max-w-4xl space-y-6'
    >
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
              <Select
                onValueChange={field.onChange}
                value={field.value || 'draft'}
              >
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
          name='templateId'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice Template</FormLabel>
              <Select
                onValueChange={(value) =>
                  field.onChange(value === 'none' ? null : value)
                }
                value={field.value || 'none'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder='Select template (optional)' />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value='none'>
                    No Template (Use Default)
                  </SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name} {template.isDefault && '(Default)'}
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
          <label className='text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70'>
            Items *
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

        <div className='space-y-4 rounded-md border p-4'>
          {fields.map((field, index) => (
            <div key={field.id} className='grid grid-cols-12 items-end gap-2'>
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
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 1)
                        }
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
                name={`items.${index}.taxRate`}
                render={({ field }) => (
                  <FormItem className='col-span-1'>
                    <FormLabel>Tax %</FormLabel>
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

              <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={() => remove(index)}
                className='col-span-1'
              >
                <IconTrash className='text-destructive h-4 w-4' />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Tax Profile Selector */}
      {taxProfiles.length > 0 && (
        <div className='space-y-3 rounded-lg border p-4'>
          <div className='space-y-2'>
            <Label htmlFor='tax-profile' className='text-base font-semibold'>
              Tax Profile (Optional)
            </Label>
            <p className='text-muted-foreground text-sm'>
              Select a tax profile to automatically calculate taxes
            </p>
            <Select
              value={selectedTaxProfileId || 'none'}
              onValueChange={(value) => {
                if (value === 'none') {
                  setSelectedTaxProfileId(null);
                  setTaxCalculationResult(null);
                } else {
                  setSelectedTaxProfileId(value);
                }
              }}
            >
              <SelectTrigger id='tax-profile'>
                <SelectValue placeholder='Select tax profile...' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>
                  None (use manual tax rates)
                </SelectItem>
                {taxProfiles.map((profile: any) => (
                  <SelectItem key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.isDefault && ' (Default)'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedTaxProfileId &&
            selectedTaxProfileId !== 'none' &&
            !form.watch('customerId') && (
              <Alert variant='default'>
                <Info className='h-4 w-4' />
                <AlertDescription>
                  Please select a customer to calculate tax
                </AlertDescription>
              </Alert>
            )}

          {selectedTaxProfileId &&
            selectedTaxProfileId !== 'none' &&
            isCalculatingTax && (
              <div className='text-muted-foreground flex items-center gap-2 text-sm'>
                <Loader2 className='h-4 w-4 animate-spin' />
                Calculating tax...
              </div>
            )}

          {selectedTaxProfileId &&
            selectedTaxProfileId !== 'none' &&
            taxCalculationResult &&
            taxCalculationResult.taxes.length > 0 && (
              <div className='bg-muted space-y-1 rounded-md p-3'>
                {taxCalculationResult.taxes.map((tax, index) => (
                  <div key={index} className='flex justify-between text-sm'>
                    <span className='text-muted-foreground'>{tax.name}:</span>
                    <span className='font-medium'>
                      {formatCurrency(
                        tax.amount,
                        form.watch('currency') || 'USD'
                      )}{' '}
                      ({tax.rate}%)
                    </span>
                  </div>
                ))}
                <div className='mt-1 flex justify-between border-t pt-1 text-sm font-medium'>
                  <span>Total Tax:</span>
                  <span>
                    {formatCurrency(
                      taxCalculationResult.taxAmount,
                      form.watch('currency') || 'USD'
                    )}
                  </span>
                </div>
              </div>
            )}
        </div>
      )}

      <div className='ml-auto w-64 space-y-2 rounded-md border p-4'>
        <div className='flex justify-between'>
          <span>Subtotal:</span>
          <span>
            {formatCurrency(totals.subtotal, form.watch('currency') || 'USD')}
          </span>
        </div>
        {totals.manualTax > 0 && (
          <div className='flex justify-between'>
            <span>Manual Tax:</span>
            <span>
              {formatCurrency(
                totals.manualTax,
                form.watch('currency') || 'USD'
              )}
            </span>
          </div>
        )}
        {totals.customTax > 0 && (
          <div className='flex justify-between'>
            <span>Tax (Profile):</span>
            <span>
              {formatCurrency(
                totals.customTax,
                form.watch('currency') || 'USD'
              )}
            </span>
          </div>
        )}
        <div className='flex justify-between'>
          <span>Total Tax:</span>
          <span>
            {formatCurrency(totals.totalTax, form.watch('currency') || 'USD')}
          </span>
        </div>
        <div className='flex justify-between border-t pt-2 text-lg font-bold'>
          <span>Total:</span>
          <span>
            {formatCurrency(totals.total, form.watch('currency') || 'USD')}
          </span>
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
        <Button
          type='submit'
          disabled={createInvoice.isPending || updateInvoice.isPending}
        >
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
