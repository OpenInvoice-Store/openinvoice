'use client';
import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { Invoice } from '@/features/invoicing/hooks/use-invoices';
import { Column, ColumnDef } from '@tanstack/react-table';
import {
  Calendar,
  DollarSign,
  FileText,
  User,
  Hash,
  Globe
} from 'lucide-react';
import { formatDate, formatCurrency } from '@/lib/format';
import { getInvoiceCurrency } from '@/lib/currency';
import { CellAction } from './cell-action';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-gray-400'
};

const STATUS_OPTIONS = [
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
  { label: 'Cancelled', value: 'cancelled' }
];

const calculateTotal = (invoice: Invoice) => {
  // Safety check for items array
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

export const columns: ColumnDef<Invoice>[] = [
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
    id: 'customer',
    accessorFn: (row) => row.customer?.name || '',
    header: ({ column }: { column: Column<Invoice, unknown> }) => (
      <DataTableColumnHeader column={column} title='Customer' />
    ),
    cell: ({ row }) => {
      const customer = row.original.customer;
      return <div className='font-medium'>{customer?.name || '-'}</div>;
    },
    meta: {
      label: 'Customer',
      placeholder: 'Search customers...',
      variant: 'text',
      icon: User
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
    id: 'total',
    accessorFn: (row) => calculateTotal(row),
    header: ({ column }: { column: Column<Invoice, unknown> }) => (
      <DataTableColumnHeader column={column} title='Total' />
    ),
    cell: ({ row }) => {
      const total = calculateTotal(row.original);
      const currency = getInvoiceCurrency(row.original);
      return (
        <div className='font-medium'>{formatCurrency(total, currency)}</div>
      );
    },
    meta: {
      label: 'Total',
      variant: 'number',
      icon: DollarSign
    },
    enableColumnFilter: true
  },
  {
    id: 'currency',
    accessorFn: (row) => getInvoiceCurrency(row),
    header: ({ column }: { column: Column<Invoice, unknown> }) => (
      <DataTableColumnHeader column={column} title='Currency' />
    ),
    cell: ({ row }) => {
      const currency = getInvoiceCurrency(row.original);
      return <div className='font-medium'>{currency}</div>;
    },
    meta: {
      label: 'Currency',
      variant: 'text',
      icon: Globe
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
          className={`${statusColors[status] || 'bg-gray-500'} text-white capitalize`}
        >
          {status}
        </Badge>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Status',
      variant: 'multiSelect',
      options: STATUS_OPTIONS
    }
  },
  {
    id: 'actions',
    cell: ({ row }) => <CellAction data={row.original} />
  }
];
