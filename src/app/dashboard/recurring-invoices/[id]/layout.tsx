'use client';

import { usePathname, useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useRecurringInvoice,
  useDeleteRecurringInvoice
} from '@/features/invoicing/hooks/use-recurring-invoices';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconEdit, IconTrash, IconArrowLeft } from '@tabler/icons-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { recurringInvoiceNavItems } from '@/config/recurring-invoice-nav-config';

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

export default function RecurringInvoiceDetailLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const id = params?.id as string;
  const templateQuery = useRecurringInvoice(id);
  const { data: template, isLoading } = templateQuery;
  const deleteTemplate = useDeleteRecurringInvoice();

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${template?.name}"? This will not delete invoices already generated.`
      )
    ) {
      return;
    }

    try {
      await deleteTemplate.mutateAsync(template!.id);
      toast.success('Recurring invoice template deleted');
      router.push('/dashboard/recurring-invoices');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete template'
      );
    }
  };

  if (isLoading) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='text-center'>
          <div className='text-muted-foreground'>Loading template...</div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className='flex min-h-[400px] items-center justify-center'>
        <div className='text-center'>
          <h2 className='text-2xl font-semibold'>Template Not Found</h2>
          <p className='text-muted-foreground mt-2'>
            The recurring invoice template you're looking for doesn't exist.
          </p>
        </div>
      </div>
    );
  }

  // Get current section from pathname
  const pathParts = pathname?.split('/').filter(Boolean) || [];
  const lastPart = pathParts[pathParts.length - 1];
  const currentSection =
    lastPart === id ||
    !recurringInvoiceNavItems.some((item) => item.href === lastPart)
      ? 'overview'
      : lastPart;

  // Helper function to get badge count
  const getBadgeCount = (badgeKey?: string): number | null => {
    if (!badgeKey) return null;
    if (badgeKey === 'invoices.length') return template.invoices?.length || 0;
    return null;
  };

  const statusConfig = statusColors[template.status] || {
    variant: 'outline',
    className: ''
  };

  return (
    <div className='space-y-0'>
      {/* Header with Template info on left and actions on right */}
      <div className='flex items-center justify-between border-b px-6 py-4'>
        <div className='flex items-center gap-3'>
          <h2 className='text-2xl font-bold'>{template.name}</h2>
          <Badge
            variant={statusConfig.variant}
            className={statusConfig.className}
          >
            {template.status}
          </Badge>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button variant='ghost' onClick={() => router.back()}>
            <IconArrowLeft className='mr-2 h-4 w-4' />
            Back
          </Button>
          <Button variant='outline' asChild>
            <Link href={`/dashboard/recurring-invoices/${id}/edit`}>
              <IconEdit className='mr-2 h-4 w-4' /> Edit
            </Link>
          </Button>
          <Button
            variant='destructive'
            onClick={handleDelete}
            disabled={deleteTemplate.isPending}
          >
            <IconTrash className='mr-2 h-4 w-4' />
            Delete
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
              {recurringInvoiceNavItems
                .filter((item) => {
                  // Hide Usage section if not usage-based
                  if (item.href === 'usage' && !template.isUsageBased) {
                    return false;
                  }
                  return true;
                })
                .map((item) => {
                  const Icon = item.icon;
                  const href = `/dashboard/recurring-invoices/${id}/${item.href}`;
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
                        <span className='ml-auto rounded-full bg-blue-100 px-2 text-xs font-medium text-blue-700'>
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
