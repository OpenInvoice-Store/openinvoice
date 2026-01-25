'use client';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Column, ColumnDef } from '@tanstack/react-table';
import { Calendar, DollarSign, Hash } from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Invoice } from '@/features/invoicing/hooks/use-customers';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-gray-400'
};

const calculateTotal = (invoice: Invoice) => {
  if (
    !invoice.items ||
    !Array.isArray(invoice.items) ||
    invoice.items.length === 0
  ) {
    return 0;
  }

  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  return subtotal + tax;
};

export const customerInvoiceColumns: ColumnDef<Invoice>[] = [
  {
    id: 'invoiceNo',
    accessorKey: 'invoiceNo',
    header: ({ column }: { column: Column<Invoice, unknown> }) => (
      <DataTableColumnHeader column={column} title='Invoice #' />
    ),
    cell: ({ cell }) => {
      const invoiceNo = cell.getValue<Invoice['invoiceNo']>();
      return <div className='font-medium'>#{invoiceNo}</div>;
    },
    meta: {
      label: 'Invoice Number',
      placeholder: 'Search invoices...',
      variant: 'text',
      icon: Hash
    },
    enableColumnFilter: true
  },
  {
    id: 'issueDate',
    accessorKey: 'issueDate',
    header: ({ column }: { column: Column<Invoice, unknown> }) => (
      <DataTableColumnHeader column={column} title='Issue Date' />
    ),
    cell: ({ cell }) => {
      const date = cell.getValue<Invoice['issueDate']>();
      return <div>{formatDate(date)}</div>;
    },
    meta: {
      label: 'Issue Date',
      variant: 'date',
      icon: Calendar
    },
    enableColumnFilter: true
  },
  {
    id: 'dueDate',
    accessorKey: 'dueDate',
    header: ({ column }: { column: Column<Invoice, unknown> }) => (
      <DataTableColumnHeader column={column} title='Due Date' />
    ),
    cell: ({ cell }) => {
      const date = cell.getValue<Invoice['dueDate']>();
      return <div>{formatDate(date)}</div>;
    },
    meta: {
      label: 'Due Date',
      variant: 'date',
      icon: Calendar
    },
    enableColumnFilter: true
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({ column }: { column: Column<Invoice, unknown> }) => (
      <DataTableColumnHeader column={column} title='Status' />
    ),
    cell: ({ cell }) => {
      const status = cell.getValue<Invoice['status']>();
      return (
        <Badge
          variant={
            status === 'paid'
              ? 'default'
              : status === 'overdue'
                ? 'destructive'
                : 'outline'
          }
          className={
            status === 'paid'
              ? 'bg-green-600'
              : status === 'overdue'
                ? 'bg-red-600'
                : ''
          }
        >
          {status}
        </Badge>
      );
    },
    enableColumnFilter: true
  },
  {
    id: 'total',
    accessorFn: (row) => calculateTotal(row),
    header: ({ column }: { column: Column<Invoice, unknown> }) => (
      <DataTableColumnHeader column={column} title='Amount' />
    ),
    cell: ({ row }) => {
      const total = calculateTotal(row.original);
      return (
        <div className='text-right font-medium'>{formatCurrency(total)}</div>
      );
    },
    meta: {
      label: 'Amount',
      variant: 'number',
      icon: DollarSign
    },
    enableColumnFilter: true
  },
  {
    id: 'actions',
    header: () => <div className='text-right'>Actions</div>,
    cell: ({ row }) => {
      const invoice = row.original;
      return (
        <div className='flex justify-end'>
          <Button variant='ghost' size='sm' asChild>
            <Link href={`/dashboard/invoices/${invoice.id}`}>View</Link>
          </Button>
        </div>
      );
    }
  }
];
