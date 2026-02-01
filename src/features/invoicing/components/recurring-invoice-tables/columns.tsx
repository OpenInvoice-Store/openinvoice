'use client';

import { ColumnDef, Column } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import {
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconPlayerPlay,
  IconPlayerPause,
  IconX,
  IconEye
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  useDeleteRecurringInvoice,
  useUpdateRecurringInvoice,
  useGenerateRecurringInvoice,
  type RecurringInvoiceTemplate
} from '../../hooks/use-recurring-invoices';
import { formatDate, formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { FileText, User, Calendar, DollarSign, Hash } from 'lucide-react';
import { getInvoiceCurrency } from '@/lib/currency';
import { calculateItemTotals } from '@/lib/invoice-calculations';

function RecurringInvoiceActions({
  template
}: {
  template: RecurringInvoiceTemplate;
}) {
  const router = useRouter();
  const deleteTemplate = useDeleteRecurringInvoice();
  const updateTemplate = useUpdateRecurringInvoice();
  const generateInvoice = useGenerateRecurringInvoice();

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${template.name}"? This will not delete invoices already generated.`
      )
    ) {
      return;
    }

    try {
      await deleteTemplate.mutateAsync(template.id);
      toast.success('Recurring invoice template deleted');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete template'
      );
    }
  };

  const handleStatusChange = async (
    newStatus: 'active' | 'paused' | 'cancelled'
  ) => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        status: newStatus
      });
      toast.success(
        `Template ${newStatus === 'active' ? 'activated' : newStatus === 'paused' ? 'paused' : 'cancelled'}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update template'
      );
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generateInvoice.mutateAsync(template.id);
      toast.success(
        `Invoice #${result.invoice.invoiceNo} generated successfully`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate invoice'
      );
    }
  };

  // Calculate total from template items
  const calculateTotal = () => {
    try {
      const items = JSON.parse(template.templateItems);
      const { total } = calculateItemTotals(items);
      return total;
    } catch {
      return 0;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' className='h-8 w-8 p-0' data-no-row-click>
          <span className='sr-only'>Open menu</span>
          <IconDotsVertical className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            router.push(`/dashboard/recurring-invoices/${template.id}`)
          }
        >
          <IconEye className='mr-2 h-4 w-4' />
          View
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            router.push(`/dashboard/recurring-invoices/${template.id}/edit`)
          }
        >
          <IconEdit className='mr-2 h-4 w-4' />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleGenerate}
          disabled={template.status !== 'active'}
        >
          <IconPlayerPlay className='mr-2 h-4 w-4' />
          Generate Invoice Now
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {template.status === 'active' ? (
          <DropdownMenuItem onClick={() => handleStatusChange('paused')}>
            <IconPlayerPause className='mr-2 h-4 w-4' />
            Pause
          </DropdownMenuItem>
        ) : template.status === 'paused' ? (
          <DropdownMenuItem onClick={() => handleStatusChange('active')}>
            <IconPlayerPlay className='mr-2 h-4 w-4' />
            Resume
          </DropdownMenuItem>
        ) : null}
        {template.status !== 'cancelled' && (
          <DropdownMenuItem onClick={() => handleStatusChange('cancelled')}>
            <IconX className='mr-2 h-4 w-4' />
            Cancel
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDelete} className='text-destructive'>
          <IconTrash className='mr-2 h-4 w-4' />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const STATUS_OPTIONS = [
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Cancelled', value: 'cancelled' },
  { label: 'Completed', value: 'completed' }
];

const FREQUENCY_OPTIONS = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Bi-weekly', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
  { label: 'Custom', value: 'custom' }
];

export const columns: ColumnDef<RecurringInvoiceTemplate>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({
      column
    }: {
      column: Column<RecurringInvoiceTemplate, unknown>;
    }) => <DataTableColumnHeader column={column} title='Template Name' />,
    cell: ({ row }) => {
      const template = row.original;
      return (
        <div className='flex flex-col'>
          <div className='flex items-center gap-2'>
            <Link
              href={`/dashboard/recurring-invoices/${template.id}`}
              className='font-medium hover:underline'
              onClick={(e) => e.stopPropagation()}
            >
              {template.name}
            </Link>
            {template.isUsageBased && (
              <Badge variant='secondary' className='text-xs'>
                Usage
              </Badge>
            )}
          </div>
          <span className='text-muted-foreground text-xs'>
            {template.customer?.name || 'Unknown Customer'}
          </span>
        </div>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Template Name',
      placeholder: 'Search templates...',
      variant: 'text',
      icon: FileText
    }
  },
  {
    id: 'customer',
    accessorFn: (row) => row.customer?.name || '',
    header: ({
      column
    }: {
      column: Column<RecurringInvoiceTemplate, unknown>;
    }) => <DataTableColumnHeader column={column} title='Customer' />,
    cell: ({ row }) => {
      const customer = row.original.customer;
      return <div className='text-sm'>{customer?.name || 'Unknown'}</div>;
    },
    enableColumnFilter: true,
    meta: {
      label: 'Customer',
      placeholder: 'Search customers...',
      variant: 'text',
      icon: User
    }
  },
  {
    id: 'frequency',
    accessorKey: 'frequency',
    header: ({
      column
    }: {
      column: Column<RecurringInvoiceTemplate, unknown>;
    }) => <DataTableColumnHeader column={column} title='Frequency' />,
    cell: ({ row }) => {
      const template = row.original;
      const frequencyLabels: Record<string, string> = {
        daily: 'Daily',
        weekly: 'Weekly',
        biweekly: 'Bi-weekly',
        monthly: 'Monthly',
        quarterly: 'Quarterly',
        yearly: 'Yearly',
        custom: `Every ${template.interval} days`
      };
      return (
        <div className='flex flex-col'>
          <span>
            {frequencyLabels[template.frequency] || template.frequency}
          </span>
          {template.frequency === 'custom' && (
            <span className='text-muted-foreground text-xs'>
              Custom interval
            </span>
          )}
        </div>
      );
    },
    enableColumnFilter: true,
    meta: {
      label: 'Frequency',
      variant: 'multiSelect',
      options: FREQUENCY_OPTIONS
    }
  },
  {
    id: 'status',
    accessorKey: 'status',
    header: ({
      column
    }: {
      column: Column<RecurringInvoiceTemplate, unknown>;
    }) => <DataTableColumnHeader column={column} title='Status' />,
    cell: ({ cell }) => {
      const status = cell.getValue<RecurringInvoiceTemplate['status']>();
      const statusColors: Record<
        string,
        {
          variant: 'default' | 'secondary' | 'destructive' | 'outline';
          className: string;
        }
      > = {
        active: { variant: 'default', className: 'bg-green-600' },
        paused: { variant: 'secondary', className: 'bg-yellow-600' },
        cancelled: { variant: 'destructive', className: 'bg-red-600' },
        completed: { variant: 'outline', className: '' }
      };
      const config = statusColors[status] || {
        variant: 'outline',
        className: ''
      };
      return (
        <Badge variant={config.variant} className={config.className}>
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
    id: 'nextGenerationDate',
    accessorKey: 'nextGenerationDate',
    header: ({
      column
    }: {
      column: Column<RecurringInvoiceTemplate, unknown>;
    }) => <DataTableColumnHeader column={column} title='Next Generation' />,
    cell: ({ row }) => {
      const date = new Date(row.original.nextGenerationDate);
      return <div className='text-sm'>{format(date, 'MMM d, yyyy')}</div>;
    },
    enableColumnFilter: true,
    meta: {
      label: 'Next Generation',
      variant: 'date',
      icon: Calendar
    }
  },
  {
    id: 'totalGenerated',
    accessorKey: 'totalGenerated',
    header: ({
      column
    }: {
      column: Column<RecurringInvoiceTemplate, unknown>;
    }) => <DataTableColumnHeader column={column} title='Generated' />,
    cell: ({ row }) => {
      return (
        <div className='text-sm'>
          {row.original.totalGenerated} invoice
          {row.original.totalGenerated !== 1 ? 's' : ''}
        </div>
      );
    }
  },
  {
    id: 'amount',
    accessorFn: (row) => {
      try {
        const items = JSON.parse(row.templateItems);
        const { total } = calculateItemTotals(items);
        return total;
      } catch {
        return 0;
      }
    },
    header: ({
      column
    }: {
      column: Column<RecurringInvoiceTemplate, unknown>;
    }) => <DataTableColumnHeader column={column} title='Amount' />,
    cell: ({ row }) => {
      const template = row.original;
      // Get currency from template or organization default
      const currency = getInvoiceCurrency(
        {
          currency: (template as any).currency,
          organization: template.organization
        },
        template.organization?.defaultCurrency
      );

      if (template.isUsageBased) {
        return (
          <div className='text-right'>
            <div className='text-muted-foreground text-sm italic'>Variable</div>
            {template.usageUnit && (
              <div className='text-muted-foreground text-xs'>
                per {template.usageUnit}
              </div>
            )}
            <div className='text-muted-foreground mt-1 text-xs'>{currency}</div>
          </div>
        );
      }
      try {
        const items = JSON.parse(template.templateItems);
        const { total } = calculateItemTotals(items);
        return (
          <div className='text-right'>
            <div className='font-medium'>{formatCurrency(total, currency)}</div>
            <div className='text-muted-foreground text-xs'>{currency}</div>
          </div>
        );
      } catch {
        return <div className='text-muted-foreground text-right'>-</div>;
      }
    },
    enableColumnFilter: true,
    meta: {
      label: 'Amount',
      variant: 'number',
      icon: DollarSign
    }
  },
  {
    id: 'actions',
    header: () => <div className='text-right'>Actions</div>,
    cell: ({ row }) => {
      return (
        <div className='flex justify-end'>
          <RecurringInvoiceActions template={row.original} />
        </div>
      );
    }
  }
];
