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
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { useCreateUsageRecord } from '../hooks/use-recurring-invoices';
import { toast } from 'sonner';
import { IconPlus } from '@tabler/icons-react';
import { useState } from 'react';

const usageRecordSchema = z.object({
  periodStart: z.string().min(1, 'Start date is required'),
  periodEnd: z.string().min(1, 'End date is required'),
  quantity: z.number().min(0, 'Quantity must be non-negative'),
  metadata: z.string().optional()
});

type UsageRecordFormData = z.infer<typeof usageRecordSchema>;

interface UsageRecordFormProps {
  templateId: string;
  usageUnit?: string | null;
}

export function UsageRecordForm({
  templateId,
  usageUnit
}: UsageRecordFormProps) {
  const [open, setOpen] = useState(false);
  const createUsageRecord = useCreateUsageRecord();

  const form = useForm<UsageRecordFormData>({
    resolver: zodResolver(usageRecordSchema),
    defaultValues: {
      periodStart: new Date().toISOString().split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0],
      quantity: 0,
      metadata: ''
    }
  });

  const onSubmit = async (data: UsageRecordFormData) => {
    try {
      await createUsageRecord.mutateAsync({
        recurringTemplateId: templateId,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        quantity: data.quantity,
        metadata: data.metadata || undefined
      });
      toast.success('Usage record created successfully');
      form.reset();
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create usage record'
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <IconPlus className='mr-2 h-4 w-4' />
          Record Usage
        </Button>
      </DialogTrigger>
      <DialogContent className='sm:max-w-[500px]'>
        <DialogHeader>
          <DialogTitle>Record Usage</DialogTitle>
          <DialogDescription>
            Record usage data for this billing period. This will be used to
            calculate invoice amounts.
          </DialogDescription>
        </DialogHeader>
        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-4'
        >
          <div className='grid grid-cols-2 gap-4'>
            <FormField
              control={form.control}
              name='periodStart'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period Start *</FormLabel>
                  <FormControl>
                    <Input type='date' {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='periodEnd'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period End *</FormLabel>
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
            name='quantity'
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Usage Quantity {usageUnit && `(${usageUnit})`} *
                </FormLabel>
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
                <FormDescription>
                  The amount of usage for this period
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='metadata'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder='Additional notes about this usage record...'
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type='submit' disabled={createUsageRecord.isPending}>
              {createUsageRecord.isPending ? 'Recording...' : 'Record Usage'}
            </Button>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
