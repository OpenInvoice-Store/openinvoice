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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  useCreateCustomer,
  useCustomer,
  useUpdateCustomer
} from '../hooks/use-customers';
import { toast } from 'sonner';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { FormDescription } from '@/components/ui/form';
import { COUNTRIES } from '@/constants/countries';

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(), // Legacy free-form address
  // Structured address fields for TaxJar
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  taxExempt: z.boolean().optional(),
  taxExemptionReason: z.string().optional(),
  taxId: z.string().optional()
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
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'US',
      taxExempt: false,
      taxExemptionReason: '',
      taxId: ''
    }
  });

  useEffect(() => {
    if (customer && isEditing) {
      form.reset({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        addressLine1: (customer as any).addressLine1 || '',
        addressLine2: (customer as any).addressLine2 || '',
        city: (customer as any).city || '',
        state: (customer as any).state || '',
        postalCode: (customer as any).postalCode || '',
        country: (customer as any).country || 'US',
        taxExempt: (customer as any).taxExempt || false,
        taxExemptionReason: (customer as any).taxExemptionReason || '',
        taxId: (customer as any).taxId || ''
      });
    }
  }, [customer, isEditing, form]);

  const onSubmit = async (data: CustomerFormData) => {
    try {
      if (isEditing && id) {
        await updateCustomer.mutateAsync({
          id,
          ...data
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
    <div className='max-w-2xl space-y-8'>
      <Form
        form={form}
        onSubmit={form.handleSubmit(onSubmit)}
        className='space-y-4'
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

        {/* Structured Address Fields for TaxJar */}
        <div className='space-y-4 rounded-lg border p-4'>
          <div className='space-y-2'>
            <h3 className='text-sm font-semibold'>Address</h3>
            <p className='text-muted-foreground text-xs'>
              Structured address information for accurate tax calculations
              (TaxJar)
            </p>
          </div>

          <FormField
            control={form.control}
            name='addressLine1'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Street Address</FormLabel>
                <FormControl>
                  <Input {...field} placeholder='123 Main St' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='addressLine2'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address Line 2 (Optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder='Apt, Suite, Unit, etc.' />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='city'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder='New York' />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='state'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {form.watch('country') === 'US' || !form.watch('country')
                      ? 'State'
                      : 'State/Province'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={
                        form.watch('country') === 'US' || !form.watch('country')
                          ? 'CA, NY, TX'
                          : 'Ontario, BC'
                      }
                      maxLength={50}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='postalCode'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {form.watch('country') === 'US' || !form.watch('country')
                      ? 'ZIP Code'
                      : 'Postal Code'}
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={
                        form.watch('country') === 'US' || !form.watch('country')
                          ? '90210'
                          : 'K1A 0B1'
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='country'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || 'US'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder='Select country' />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Required for accurate tax calculations with TaxJar
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Legacy Address Field (Optional) */}
          <FormField
            control={form.control}
            name='address'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Address (Legacy - Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    placeholder='Full address as text (for display purposes)'
                  />
                </FormControl>
                <FormDescription>
                  Optional: Full address as text. Structured fields above are
                  preferred for tax calculations.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Tax Exemption Section */}
        <div className='space-y-4 rounded-lg border p-4'>
          <div className='space-y-2'>
            <h3 className='text-sm font-semibold'>Tax Information</h3>
            <p className='text-muted-foreground text-xs'>
              Configure tax exemption status and tax ID for this customer
            </p>
          </div>

          <FormField
            control={form.control}
            name='taxExempt'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-3'>
                <div className='space-y-0.5'>
                  <FormLabel>Tax Exempt</FormLabel>
                  <FormDescription>
                    Mark this customer as tax exempt (e.g., nonprofit, export)
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {form.watch('taxExempt') && (
            <>
              <FormField
                control={form.control}
                name='taxExemptionReason'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exemption Reason</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select exemption reason' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='nonprofit'>
                          Nonprofit Organization
                        </SelectItem>
                        <SelectItem value='export'>
                          Export/International
                        </SelectItem>
                        <SelectItem value='government'>
                          Government Entity
                        </SelectItem>
                        <SelectItem value='resale'>
                          Resale Certificate
                        </SelectItem>
                        <SelectItem value='other'>Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <FormField
            control={form.control}
            name='taxId'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tax ID</FormLabel>
                <FormControl>
                  <Input {...field} placeholder='e.g., VAT, GST, EIN, SSN' />
                </FormControl>
                <FormDescription>
                  Customer's tax identification number for tax reporting
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className='flex gap-2'>
          <Button
            type='submit'
            disabled={createCustomer.isPending || updateCustomer.isPending}
          >
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
    </div>
  );
}
