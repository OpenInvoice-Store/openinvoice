'use client';

import { usePathname, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  useCustomer,
  useCustomerPayments
} from '@/features/invoicing/hooks/use-customers';
import { Button } from '@/components/ui/button';
import { IconEdit } from '@tabler/icons-react';
import { cn } from '@/lib/utils';
import { customerNavItems } from '@/config/customer-nav-config';

export default function CustomerDetailLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const id = params?.id as string;
  const customerQuery = useCustomer(id);
  const { data: customer, isLoading } = customerQuery;
  const { data: payments = [] } = useCustomerPayments(id);

  if (isLoading) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='text-center'>
          <div className='text-muted-foreground'>Loading customer...</div>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='text-center'>
          <h2 className='text-2xl font-semibold'>Customer Not Found</h2>
          <p className='text-muted-foreground mt-2'>
            The customer you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  // Get current section from pathname
  // Pathname will be like /dashboard/customers/[id]/details
  const pathParts = pathname?.split('/').filter(Boolean) || [];
  const lastPart = pathParts[pathParts.length - 1];
  // If last part is the customer id (numeric or matches our id), default to 'details'
  const currentSection =
    lastPart === id || !customerNavItems.some((item) => item.href === lastPart)
      ? 'details'
      : lastPart;

  // Helper function to get badge count
  const getBadgeCount = (badgeKey?: string): number | null => {
    if (!badgeKey) return null;
    if (badgeKey === 'payments.length') return payments.length;
    return null;
  };

  return (
    <div className='space-y-0'>
      {/* Header with Customer info on left and actions on right */}
      <div className='flex items-center justify-between border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <h2 className='text-2xl font-bold'>{customer.name}</h2>
          {customer.email && (
            <p className='text-muted-foreground text-sm'>{customer.email}</p>
          )}
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='outline' asChild>
            <Link href={`/dashboard/customers/${id}/edit`}>
              <IconEdit className='mr-2 h-4 w-4' /> Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Main layout: left sidebar + right content */}
      <div className='flex min-h-[calc(100vh-12rem)] gap-6'>
        {/* Left Sidebar Navigation */}
        <aside className='bg-background w-64 shrink-0 border-r'>
          <div className='p-6'>
            <h3 className='text-muted-foreground mb-6 text-xs font-semibold tracking-wide uppercase'>
              Sections
            </h3>
            <nav className='space-y-1'>
              {customerNavItems.map((item) => {
                const Icon = item.icon;
                const href = `/dashboard/customers/${id}/${item.href}`;
                const isActive = currentSection === item.href;
                const badgeCount = getBadgeCount(item.badgeKey);

                return (
                  <Link
                    key={item.href}
                    href={href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    )}
                  >
                    <Icon className='h-4 w-4' />
                    <span className='flex-1'>{item.title}</span>
                    {badgeCount !== null && badgeCount > 0 && (
                      <span className='ml-auto rounded-full bg-emerald-100 px-2 text-xs font-medium text-emerald-700'>
                        {badgeCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className='flex-1 overflow-auto'>{children}</main>
      </div>
    </div>
  );
}
