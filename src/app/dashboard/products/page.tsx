import PageContainer from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { ProductsList } from '@/features/invoicing/components/products-list';
import { cn } from '@/lib/utils';
import { IconPlus } from '@tabler/icons-react';
import Link from 'next/link';

export const metadata = {
  title: 'Dashboard: Products'
};

export default function ProductsPage() {
  return (
    <PageContainer
      scrollable={false}
      pageTitle='Products'
      pageDescription='Manage your products and services'
      pageHeaderAction={
        <Link
          href='/dashboard/products/new'
          className={cn(buttonVariants(), 'text-xs md:text-sm')}
        >
          <IconPlus className='mr-2 h-4 w-4' /> Add Product
        </Link>
      }
    >
      <ProductsList />
    </PageContainer>
  );
}

