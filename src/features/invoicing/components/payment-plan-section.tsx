'use client';

import { useState } from 'react';
import { usePaymentPlan } from '../hooks/use-payment-plan';
import { useInvoice } from '../hooks/use-invoices';
import { formatDate } from '@/lib/format';
import { formatCurrencyAmount, getInvoiceCurrency } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  IconPlus,
  IconTrash,
  IconCalendar,
  IconCurrencyDollar
} from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';

const paymentPlanSchema = z.object({
  installmentCount: z.number().min(2).max(60),
  frequency: z.enum(['weekly', 'biweekly', 'monthly', 'quarterly']),
  startDate: z.string().min(1, 'Start date is required')
});

type PaymentPlanFormData = z.infer<typeof paymentPlanSchema>;

interface PaymentPlanSectionProps {
  invoiceId: string;
  invoiceTotal: number;
  totalPaid: number;
}

export function PaymentPlanSection({
  invoiceId,
  invoiceTotal,
  totalPaid
}: PaymentPlanSectionProps) {
  const { paymentPlan, isLoading, createPaymentPlan, deletePaymentPlan } =
    usePaymentPlan(invoiceId);
  const { data: invoice } = useInvoice(invoiceId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Get currency from invoice or organization default
  const currency = getInvoiceCurrency(
    invoice as any,
    (invoice as any)?.organization?.defaultCurrency
  );

  const form = useForm<PaymentPlanFormData>({
    resolver: zodResolver(paymentPlanSchema),
    defaultValues: {
      installmentCount: 3,
      frequency: 'monthly',
      startDate: new Date().toISOString().split('T')[0]
    }
  });

  const remainingAmount = invoiceTotal - totalPaid;

  const onSubmit = async (data: PaymentPlanFormData) => {
    try {
      await createPaymentPlan.mutateAsync(data);
      setShowCreateDialog(false);
      form.reset();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleDelete = async () => {
    try {
      await deletePaymentPlan.mutateAsync();
      setShowDeleteDialog(false);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  if (isLoading) {
    return <div className='p-4'>Loading payment plan...</div>;
  }

  if (!paymentPlan) {
    if (remainingAmount <= 0) {
      return null; // Don't show payment plan option if invoice is fully paid
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconCurrencyDollar className='h-5 w-5' />
            Payment Plan
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className='text-muted-foreground mb-4 text-sm'>
            Set up a payment plan to split this invoice into multiple
            installments.
          </p>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <IconPlus className='mr-2 h-4 w-4' />
                Create Payment Plan
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Payment Plan</DialogTitle>
                <DialogDescription>
                  Split the remaining balance of{' '}
                  {formatCurrencyAmount(remainingAmount, currency)} into
                  installments.
                </DialogDescription>
              </DialogHeader>
              <Form
                form={form}
                onSubmit={form.handleSubmit(onSubmit)}
                className='space-y-4'
              >
                <FormField
                  control={form.control}
                  name='installmentCount'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Installments</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          min={2}
                          max={60}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 2)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='frequency'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Payment Frequency</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select frequency' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='weekly'>Weekly</SelectItem>
                          <SelectItem value='biweekly'>Bi-weekly</SelectItem>
                          <SelectItem value='monthly'>Monthly</SelectItem>
                          <SelectItem value='quarterly'>Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='startDate'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Payment Date</FormLabel>
                      <FormControl>
                        <Input type='date' {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className='flex justify-end gap-2'>
                  <Button
                    type='button'
                    variant='outline'
                    onClick={() => setShowCreateDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button type='submit' disabled={createPaymentPlan.isPending}>
                    Create Plan
                  </Button>
                </div>
              </Form>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-500',
    paid: 'bg-green-500',
    overdue: 'bg-red-500',
    cancelled: 'bg-gray-400'
  };

  const frequencyLabels: Record<string, string> = {
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly'
  };

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <CardTitle className='flex items-center gap-2'>
            <IconCurrencyDollar className='h-5 w-5' />
            Payment Plan
          </CardTitle>
          {paymentPlan.status === 'active' && (
            <AlertDialog
              open={showDeleteDialog}
              onOpenChange={setShowDeleteDialog}
            >
              <AlertDialogTrigger asChild>
                <Button variant='destructive' size='sm'>
                  <IconTrash className='mr-2 h-4 w-4' />
                  Delete Plan
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Payment Plan?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will delete the payment plan and all installments. This
                    action cannot be undone. You can only delete a plan if no
                    payments have been made.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className='space-y-4'>
          <div className='grid grid-cols-2 gap-4 text-sm'>
            <div>
              <span className='text-muted-foreground'>Frequency:</span>
              <p className='font-medium'>
                {frequencyLabels[paymentPlan.frequency]}
              </p>
            </div>
            <div>
              <span className='text-muted-foreground'>Status:</span>
              <Badge
                className={statusColors[paymentPlan.status] || 'bg-gray-500'}
              >
                {paymentPlan.status}
              </Badge>
            </div>
            <div>
              <span className='text-muted-foreground'>Total Amount:</span>
              <p className='font-medium'>
                {formatCurrencyAmount(paymentPlan.totalAmount, currency)}
              </p>
            </div>
            <div>
              <span className='text-muted-foreground'>Installments:</span>
              <p className='font-medium'>{paymentPlan.installmentCount}</p>
            </div>
          </div>

          <div className='border-t pt-4'>
            <h4 className='mb-3 font-semibold'>Installments</h4>
            <div className='space-y-2'>
              {paymentPlan.installments.map((installment) => (
                <div
                  key={installment.id}
                  className='flex items-center justify-between rounded-lg border p-3'
                >
                  <div className='flex items-center gap-3'>
                    <div className='bg-muted flex h-8 w-8 items-center justify-center rounded-full'>
                      #{installment.installmentNumber}
                    </div>
                    <div>
                      <div className='flex items-center gap-2'>
                        <IconCalendar className='text-muted-foreground h-4 w-4' />
                        <span className='text-sm font-medium'>
                          {formatDate(installment.dueDate)}
                        </span>
                      </div>
                      <div className='text-muted-foreground mt-1 text-xs'>
                        {installment.totalPaid !== undefined &&
                        installment.remaining !== undefined
                          ? `${formatCurrencyAmount(installment.totalPaid, currency)} / ${formatCurrencyAmount(installment.amount, currency)}`
                          : formatCurrencyAmount(installment.amount, currency)}
                      </div>
                    </div>
                  </div>
                  <Badge
                    className={
                      statusColors[installment.status] || 'bg-gray-500'
                    }
                  >
                    {installment.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
