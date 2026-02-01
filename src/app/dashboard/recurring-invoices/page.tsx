import PageContainer from '@/components/layout/page-container';
import { RecurringInvoicesList } from '@/features/invoicing/components/recurring-invoices-list';
import { buttonVariants } from '@/components/ui/button';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const metadata = {
  title: 'Dashboard: Recurring Invoices'
};

export default function RecurringInvoicesPage() {
  return (
    <PageContainer
      scrollable={false}
      pageTitle='Recurring Invoices'
      pageDescription='Manage recurring invoice templates and subscriptions'
      pageHeaderAction={
        <Link
          href='/dashboard/recurring-invoices/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> New Template
        </Link>
      }
    >
      <RecurringInvoicesList />
    </PageContainer>
  );
}
