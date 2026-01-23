'use client';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { useCreatePayment } from '../hooks/use-payments';
import { toast } from 'sonner';

const paymentSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  date: z.string().min(1, 'Date is required'),
  method: z.string().min(1, 'Payment method is required'),
  notes: z.string().optional()
});

type PaymentFormData = z.infer<typeof paymentSchema>;

export function PaymentForm({
  invoiceId,
  maxAmount,
  onSuccess
}: {
  invoiceId: string;
  maxAmount: number;
  onSuccess?: () => void;
}) {
  const createPayment = useCreatePayment();

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: maxAmount,
      date: new Date().toISOString().split('T')[0],
      method: 'bank_transfer',
      notes: ''
    }
  });

  const onSubmit = async (data: PaymentFormData) => {
    if (data.amount > maxAmount) {
      toast.error(`Amount cannot exceed ${maxAmount.toFixed(2)}`);
      return;
    }

    try {
      await createPayment.mutateAsync({
        invoiceId,
        ...data
      });
      toast.success('Payment recorded successfully');
      form.reset();
      onSuccess?.();
    } catch (error) {
      toast.error('Failed to record payment');
    }
  };

  return (
    <Form
      form={form}
      onSubmit={form.handleSubmit(onSubmit)}
      className='space-y-4 rounded-md border p-4'
    >
      <div className='grid grid-cols-2 gap-4'>
        <FormField
          control={form.control}
          name='amount'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount *</FormLabel>
              <FormControl>
                <Input
                  type='number'
                  step='0.01'
                  max={maxAmount}
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
          name='date'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date *</FormLabel>
              <FormControl>
                <Input type='date' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name='method'
        render={({ field }) => (
          <FormItem>
            <FormLabel>Payment Method *</FormLabel>
            <Select
              onValueChange={field.onChange}
              value={field.value || 'bank_transfer'}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value='cash'>Cash</SelectItem>
                <SelectItem value='bank_transfer'>Bank Transfer</SelectItem>
                <SelectItem value='credit_card'>Credit Card</SelectItem>
                <SelectItem value='paypal'>PayPal</SelectItem>
                <SelectItem value='check'>Check</SelectItem>
                <SelectItem value='other'>Other</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

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
        <Button type='submit' disabled={createPayment.isPending}>
          Record Payment
        </Button>
        <Button type='button' variant='outline' onClick={onSuccess}>
          Cancel
        </Button>
      </div>
    </Form>
  );
}
