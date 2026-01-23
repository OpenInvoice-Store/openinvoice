'use client';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Invoice, useInvoices, useUpdateInvoice } from '../hooks/use-invoices';
import { Active, DataRef, Over } from '@dnd-kit/core';
import { ColumnDragData } from '@/features/kanban/components/board-column';
import { InvoiceDragData } from './invoice-card';

type DraggableData = ColumnDragData | InvoiceDragData;

function hasDraggableData<T extends Active | Over>(
  entry: T | null | undefined
): entry is T & {
  data: DataRef<DraggableData>;
} {
  if (!entry) {
    return false;
  }

  const data = entry.data.current;

  if (data?.type === 'Column' || data?.type === 'Invoice') {
    return true;
  }

  return false;
}
import {
  Announcements,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  UniqueIdentifier,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cva } from 'class-variance-authority';
import { IconGripVertical } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Column } from '@/features/kanban/components/board-column';
import { BoardContainer } from '@/features/kanban/components/board-column';
import { InvoiceCard } from './invoice-card';
import { toast } from 'sonner';

// Invoice status columns matching the database schema
const invoiceColumns: Column[] = [
  {
    id: 'draft',
    title: 'Draft'
  },
  {
    id: 'sent',
    title: 'Sent'
  },
  {
    id: 'paid',
    title: 'Paid'
  },
  {
    id: 'overdue',
    title: 'Overdue'
  },
  {
    id: 'cancelled',
    title: 'Cancelled'
  }
];

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

export function InvoiceKanbanBoard() {
  const { data: invoices = [], isLoading } = useInvoices();
  const updateInvoice = useUpdateInvoice();
  const pickedUpInvoiceColumn = useRef<InvoiceStatus>('draft');
  const columnsId = useMemo(() => invoiceColumns.map((col) => col.id), []);

  const [activeColumn, setActiveColumn] = useState<Column | null>(null);
  const [isMounted, setIsMounted] = useState<Boolean>(false);
  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor),
    useSensor(TouchSensor)
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;
  if (isLoading) {
    return <div className='p-4'>Loading invoices...</div>;
  }

  function getDraggingInvoiceData(invoiceId: UniqueIdentifier, columnId: InvoiceStatus) {
    const invoicesInColumn = invoices.filter((invoice) => invoice.status === columnId);
    const invoicePosition = invoicesInColumn.findIndex((invoice) => invoice.id === invoiceId);
    const column = invoiceColumns.find((col) => col.id === columnId);
    return {
      invoicesInColumn,
      invoicePosition,
      column
    };
  }

  const announcements: Announcements = {
    onDragStart({ active }) {
      if (!hasDraggableData(active)) return;
      if (active.data.current?.type === 'Column') {
        const startColumnIdx = columnsId.findIndex((id) => id === active.id);
        const startColumn = invoiceColumns[startColumnIdx];
        return `Picked up Column ${startColumn?.title} at position: ${
          startColumnIdx + 1
        } of ${columnsId.length}`;
      } else if (active.data.current?.type === 'Invoice') {
        const activeData = active.data.current as InvoiceDragData;
        pickedUpInvoiceColumn.current = activeData.invoice.status as InvoiceStatus;
        const { invoicesInColumn, invoicePosition, column } = getDraggingInvoiceData(
          active.id,
          pickedUpInvoiceColumn.current
        );
        return `Picked up Invoice ${activeData.invoice.invoiceNo} from column ${column?.title} at position: ${
          invoicePosition + 1
        } of ${invoicesInColumn.length}`;
      }
    },
    onDragOver({ active, over }) {
      if (!hasDraggableData(active) || !hasDraggableData(over)) return;

      const activeData = active.data.current as DraggableData;
      const overData = over.data.current as DraggableData;

      if (activeData?.type === 'Column') {
        const overColumnIdx = columnsId.findIndex((id) => id === over.id);
        return `Column ${activeData.column.title} was moved over column ${
          invoiceColumns[overColumnIdx]?.title
        } at position ${overColumnIdx + 1}`;
      } else if (activeData?.type === 'Invoice') {
        const overColumnId = overData?.type === 'Column' 
          ? over.id 
          : invoices.find((inv) => inv.id === over.id)?.status || '';
        const overColumn = invoiceColumns.find((col) => col.id === overColumnId);
        return `Invoice ${activeData.invoice.invoiceNo} is over column ${overColumn?.title}`;
      }
    },
    onDragEnd({ active, over }) {
      if (!hasDraggableData(active) || !hasDraggableData(over)) return;

      const activeData = active.data.current as DraggableData;
      const overData = over.data.current as DraggableData;

      if (activeData?.type === 'Column') {
        return `Column ${activeData.column.title} was dropped`;
      } else if (activeData?.type === 'Invoice') {
        const newStatus = overData?.type === 'Column'
          ? over.id
          : invoices.find((inv) => inv.id === over.id)?.status || '';
        return `Invoice ${activeData.invoice.invoiceNo} was moved to ${invoiceColumns.find((col) => col.id === newStatus)?.title || newStatus}`;
      }
    },
    onDragCancel({ active }) {
      if (!hasDraggableData(active)) return;
      return `Dragging ${active.data.current?.type} cancelled.`;
    }
  };

  return (
    <DndContext
      accessibility={{
        announcements
      }}
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      <BoardContainer>
        <SortableContext items={columnsId}>
          {invoiceColumns.map((col, index) => (
            <Fragment key={col.id}>
              <InvoiceBoardColumn
                column={col}
                invoices={invoices.filter((invoice) => invoice.status === col.id)}
              />
            </Fragment>
          ))}
        </SortableContext>
      </BoardContainer>

      {'document' in window &&
        createPortal(
          <DragOverlay>
            {activeColumn && (
              <InvoiceBoardColumn
                isOverlay
                column={activeColumn}
                invoices={invoices.filter((invoice) => invoice.status === activeColumn.id)}
              />
            )}
            {activeInvoice && <InvoiceCard invoice={activeInvoice} isOverlay />}
          </DragOverlay>,
          document.body
        )}
    </DndContext>
  );

  function onDragStart(event: DragStartEvent) {
    if (!hasDraggableData(event.active)) return;
    const data = event.active.data.current as DraggableData;
    if (data?.type === 'Column') {
      setActiveColumn(data.column);
      return;
    }

    if (data?.type === 'Invoice') {
      setActiveInvoice(data.invoice);
      return;
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveColumn(null);
    setActiveInvoice(null);

    const { active, over } = event;
    if (!over || !hasDraggableData(active)) return;

    const activeData = active.data.current as DraggableData;

    if (activeData?.type === 'Invoice') {
      const invoice = activeData.invoice;
      const overData = over.data.current as DraggableData | undefined;
      const newStatus = overData?.type === 'Column'
        ? over.id.toString()
        : invoices.find((inv) => inv.id === over.id)?.status || invoice.status;

      // Only update if status changed
      if (newStatus !== invoice.status && invoiceColumns.some((col) => col.id === newStatus)) {
        updateInvoice.mutate(
          {
            id: invoice.id,
            status: newStatus as InvoiceStatus
          },
          {
            onSuccess: () => {
              toast.success(`Invoice #${invoice.invoiceNo} moved to ${invoiceColumns.find((col) => col.id === newStatus)?.title}`);
            },
            onError: () => {
              toast.error('Failed to update invoice status');
            }
          }
        );
      }
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || !hasDraggableData(active)) return;
  }
}

// Invoice-specific board column component
interface InvoiceBoardColumnProps {
  column: Column;
  invoices: Invoice[];
  isOverlay?: boolean;
}

function InvoiceBoardColumn({ column, invoices, isOverlay }: InvoiceBoardColumnProps) {
  const invoiceIds = useMemo(() => {
    return invoices.map((invoice) => invoice.id);
  }, [invoices]);

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging
  } = useSortable({
    id: column.id,
    data: {
      type: 'Column',
      column
    },
    attributes: {
      roleDescription: `Column: ${column.title}`
    }
  });

  const style = {
    transition,
    transform: CSS.Translate.toString(transform)
  };

  const variants = cva(
    'h-[75vh] max-h-[75vh] w-[350px] max-w-full bg-secondary flex flex-col shrink-0 snap-center',
    {
      variants: {
        dragging: {
          default: 'border-2 border-transparent',
          over: 'ring-2 opacity-30',
          overlay: 'ring-2 ring-primary'
        }
      }
    }
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={variants({
        dragging: isOverlay ? 'overlay' : isDragging ? 'over' : undefined
      })}
    >
      <CardHeader className='space-between flex flex-row items-center border-b-2 p-4 text-left font-semibold'>
        <Button
          variant={'ghost'}
          {...attributes}
          {...listeners}
          className='text-primary/50 relative -ml-2 h-auto cursor-grab p-1'
        >
          <span className='sr-only'>{`Move column: ${column.title}`}</span>
          <IconGripVertical />
        </Button>
        <span className='ml-2'>{column.title}</span>
        <span className='ml-auto text-sm text-muted-foreground'>({invoices.length})</span>
      </CardHeader>
      <CardContent className='flex grow flex-col gap-4 overflow-x-hidden p-2'>
        <ScrollArea className='h-full'>
          <SortableContext items={invoiceIds}>
            {invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
          </SortableContext>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

