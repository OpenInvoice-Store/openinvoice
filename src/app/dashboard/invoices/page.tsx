import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { InvoicesList } from '@/features/invoicing/components/invoices-list';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard: Invoices'
};

export default function InvoicesPage() {
  return (
    <PageContainer
      scrollable={false}
      pageTitle='Invoices'
      pageDescription='Manage your invoices'
      pageHeaderAction={
        <Link
          href='/dashboard/invoices/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> New Invoice
        </Link>
      }
    >
      <InvoicesList />
    </PageContainer>
  );
}

