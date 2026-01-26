'use client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Invoice } from '../hooks/use-invoices';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cva } from 'class-variance-authority';
import { IconGripVertical } from '@tabler/icons-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { getInvoiceCurrency } from '@/lib/currency';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';

interface InvoiceCardProps {
  invoice: Invoice;
  isOverlay?: boolean;
}

export type InvoiceCardType = 'Invoice';

export interface InvoiceDragData {
  type: InvoiceCardType;
  invoice: Invoice;
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-gray-400'
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled'
};

export function InvoiceCard({ invoice, isOverlay }: InvoiceCardProps) {
  const router = useRouter();
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: invoice.id,
    data: {
      type: 'Invoice',
      invoice
    } satisfies InvoiceDragData,
    attributes: {
      roleDescription: 'Invoice'
    }
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform)
  };

  const variants = cva('mb-2 cursor-pointer', {
    variants: {
      dragging: {
        over: 'ring-2 opacity-30',
        overlay: 'ring-2 ring-primary'
      }
    }
  });

  const totalAmount = useMemo(() => {
    const subtotal = invoice.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = invoice.items.reduce(
      (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
      0
    );
    return subtotal + tax;
  }, [invoice.items]);

  const currency = useMemo(() => {
    return getInvoiceCurrency(
      invoice as any,
      (invoice as any).organization?.defaultCurrency
    );
  }, [invoice]);

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking the drag handle
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    router.push(`/dashboard/invoices/${invoice.id}`);
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={variants({
        dragging: isOverlay ? 'overlay' : isDragging ? 'over' : undefined
      })}
      onClick={handleClick}
    >
      <CardHeader className='space-between border-secondary relative flex flex-row border-b-2 px-3 py-3'>
        <Button
          variant={'ghost'}
          {...attributes}
          {...listeners}
          className='text-secondary-foreground/50 -ml-2 h-auto cursor-grab p-1'
          onClick={(e) => e.stopPropagation()}
        >
          <span className='sr-only'>Move invoice</span>
          <IconGripVertical />
        </Button>
        <Badge
          variant={'outline'}
          className={`ml-auto font-semibold ${statusColors[invoice.status] || 'bg-gray-500'} text-white`}
        >
          {statusLabels[invoice.status] || invoice.status}
        </Badge>
      </CardHeader>
      <CardContent className='space-y-2 px-3 pt-3 pb-4 text-left'>
        <div>
          <p className='text-sm font-semibold'>Invoice #{invoice.invoiceNo}</p>
          <p className='text-muted-foreground text-xs'>
            {invoice.customer?.name || 'Unknown Customer'}
          </p>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-lg font-bold'>
            {formatCurrency(totalAmount, currency)}
          </span>
        </div>
        <div className='text-muted-foreground text-xs'>
          <p>
            Due:{' '}
            {formatDate(invoice.dueDate, {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </p>
          {invoice.issueDate && (
            <p>
              Issued:{' '}
              {formatDate(invoice.issueDate, {
                month: 'short',
                day: 'numeric'
              })}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
