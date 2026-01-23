import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { CustomersList } from '@/features/invoicing/components/customers-list';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard: Customers'
};

export default function CustomersPage() {
  return (
    <PageContainer
      scrollable={false}
      pageTitle='Customers'
      pageDescription='Manage your customers'
      pageHeaderAction={
        <Link
          href='/dashboard/customers/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> Add Customer
        </Link>
      }
    >
      <CustomersList />
    </PageContainer>
  );
}

