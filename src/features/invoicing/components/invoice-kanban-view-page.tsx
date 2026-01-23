import PageContainer from '@/components/layout/page-container';
import { InvoiceKanbanBoard } from './invoice-kanban-board';
import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { IconPlus } from '@tabler/icons-react';
import { cn } from '@/lib/utils';

export default function InvoiceKanbanViewPage() {
  return (
    <PageContainer
      scrollable={false}
      pageTitle='Invoice Kanban'
      pageDescription='Manage invoices by dragging and dropping between status columns'
      pageHeaderAction={
        <Link
          href='/dashboard/invoices/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> New Invoice
        </Link>
      }
    >
      <div className='w-full h-[calc(100vh-200px)] min-w-0'>
        <InvoiceKanbanBoard />
      </div>
    </PageContainer>
  );
}

