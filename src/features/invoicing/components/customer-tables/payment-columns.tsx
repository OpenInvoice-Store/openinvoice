'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Calendar, DollarSign, FileText } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Payment } from '@/features/invoicing/hooks/use-payments';
import { TruncatedText } from '@/components/ui/truncated-text';

export const customerPaymentColumns: ColumnDef<Payment>[] = [
  {
    id: 'date',
    accessorKey: 'date',
    header: ({ column }: { column: Column<Payment, unknown> }) => (
      <DataTableColumnHeader column={column} title='Date' />
    ),
    cell: ({ cell }) => {
      const date = cell.getValue<Payment['date']>();
      return <div>{formatDate(date)}</div>;
    },
    meta: {
      label: 'Date',
      variant: 'date',
      icon: Calendar
    },
    enableColumnFilter: true
  },
  {
    id: 'invoiceNo',
    accessorFn: (row) => row.invoice?.invoiceNo || '',
    header: ({ column }: { column: Column<Payment, unknown> }) => (
      <DataTableColumnHeader column={column} title='Invoice #' />
    ),
    cell: ({ row }) => {
      const invoice = row.original.invoice;
      if (!invoice?.invoiceNo) {
        return <div>-</div>;
      }
      return (
        <Link
          href={`/dashboard/invoices/${invoice.id}`}
          className='font-medium text-blue-600 hover:underline'
        >
          #{invoice.invoiceNo}
        </Link>
      );
    },
    meta: {
      label: 'Invoice Number',
      placeholder: 'Search invoices...',
      variant: 'text',
      icon: FileText
    },
    enableColumnFilter: true
  },
  {
    id: 'amount',
    accessorKey: 'amount',
    header: ({ column }: { column: Column<Payment, unknown> }) => (
      <DataTableColumnHeader column={column} title='Amount' />
    ),
    cell: ({ cell }) => {
      const amount = cell.getValue<Payment['amount']>();
      return <div className='font-medium'>{formatCurrency(amount)}</div>;
    },
    meta: {
      label: 'Amount',
      variant: 'number',
      icon: DollarSign
    },
    enableColumnFilter: true
  },
  {
    id: 'method',
    accessorKey: 'method',
    header: ({ column }: { column: Column<Payment, unknown> }) => (
      <DataTableColumnHeader column={column} title='Method' />
    ),
    cell: ({ cell }) => {
      const method = cell.getValue<Payment['method']>();
      return <TruncatedText text={method || '-'} maxLength={20} />;
    },
    meta: {
      label: 'Payment Method',
      placeholder: 'Search methods...',
      variant: 'text',
      icon: FileText
    },
    enableColumnFilter: true
  },
  {
    id: 'status',
    accessorFn: (row) => {
      if (row.stripeStatus === 'succeeded') return 'succeeded';
      if (row.stripeStatus === 'pending') return 'pending';
      if (row.stripeStatus === 'failed') return 'failed';
      if (row.stripeStatus === 'canceled') return 'canceled';
      return 'manual';
    },
    header: ({ column }: { column: Column<Payment, unknown> }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ row }) => {
      const payment = row.original;
      const isFailed = payment.stripeStatus === 'failed';
      const hasRetry =
        payment.retryStatus && payment.retryStatus !== 'exhausted';
      const retryCount = payment.retryCount || 0;
      const maxRetries = payment.maxRetries || 3;

      if (payment.stripeStatus === 'succeeded') {
        return (
          <Badge variant='default' className='bg-green-600'>
            Succeeded
          </Badge>
        );
      }
      if (payment.stripeStatus === 'pending') {
        return (
          <Badge variant='default' className='bg-yellow-600'>
            Pending
          </Badge>
        );
      }
      if (isFailed) {
        return (
          <div className='flex flex-col gap-1'>
            <Badge variant='destructive'>Failed</Badge>
            {hasRetry && (
              <Badge variant='outline' className='text-xs'>
                Retry {retryCount}/{maxRetries}
              </Badge>
            )}
            {payment.retryStatus === 'exhausted' && (
              <Badge
                variant='outline'
                className='text-muted-foreground text-xs'
              >
                Retries exhausted
              </Badge>
            )}
          </div>
        );
      }
      if (payment.stripeStatus === 'canceled') {
        return <Badge variant='outline'>Canceled</Badge>;
      }
      return <Badge variant='outline'>Manual</Badge>;
    },
    enableColumnFilter: true
  },
  {
    id: 'notes',
    accessorKey: 'notes',
    header: ({ column }: { column: Column<Payment, unknown> }) => (
      <DataTableColumnHeader column={column} title='Notes' />
    ),
    cell: ({ row }) => {
      const payment = row.original;
      const notes = payment.notes || '-';
      const hasNextRetry =
        payment.stripeStatus === 'failed' && payment.nextRetryAt;

      return (
        <div className='max-w-xs'>
          <TruncatedText text={notes} maxLength={30} />
          {hasNextRetry && (
            <div className='text-muted-foreground mt-1 text-xs'>
              Next retry: {formatDate(payment.nextRetryAt!)}
            </div>
          )}
        </div>
      );
    },
    meta: {
      label: 'Notes',
      placeholder: 'Search notes...',
      variant: 'text',
      icon: FileText
    },
    enableColumnFilter: true
  },
  {
    id: 'actions',
    header: () => <div className='text-right'>Actions</div>,
    cell: ({ row }) => {
      const payment = row.original;
      return (
        <div className='flex justify-end'>
          <Button
            variant='ghost'
            size='sm'
            onClick={() =>
              window.open(`/api/payments/${payment.id}/receipt`, '_blank')
            }
          >
            Receipt
          </Button>
        </div>
      );
    }
  }
];
