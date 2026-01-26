'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';
import { useRecentInvoices } from '../hooks/use-dashboard-stats';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function RecentSales() {
  const { data: recentInvoices = [], isLoading } = useRecentInvoices();

  if (isLoading) {
    return (
      <Card className='h-full'>
        <CardHeader>
          <CardTitle>Recent Invoices</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='space-y-8'>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className='flex items-center'>
                <div className='bg-muted h-9 w-9 animate-pulse rounded-full' />
                <div className='ml-4 flex-1 space-y-2'>
                  <div className='bg-muted h-4 w-24 animate-pulse rounded' />
                  <div className='bg-muted h-3 w-32 animate-pulse rounded' />
                </div>
                <div className='bg-muted h-4 w-16 animate-pulse rounded' />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const invoiceCount = recentInvoices.length;

  return (
    <Card className='h-full'>
      <CardHeader>
        <CardTitle>Recent Invoices</CardTitle>
        <CardDescription>
          {invoiceCount > 0
            ? `Latest ${invoiceCount} invoice${invoiceCount !== 1 ? 's' : ''}`
            : 'No invoices yet'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {invoiceCount === 0 ? (
          <div className='text-muted-foreground py-8 text-center'>
            No invoices to display
          </div>
        ) : (
          <div className='space-y-8'>
            {recentInvoices.map((invoice: any) => (
              <div key={invoice.id} className='flex items-center'>
                <Avatar className='h-9 w-9'>
                  <AvatarFallback>
                    {getInitials(invoice.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div className='ml-4 space-y-1'>
                  <p className='text-sm leading-none font-medium'>
                    {invoice.customerName}
                  </p>
                  <p className='text-muted-foreground text-sm'>
                    Invoice #{invoice.invoiceNo}{' '}
                    {invoice.customerEmail ? `• ${invoice.customerEmail}` : ''}
                  </p>
                </div>
                <div className='ml-auto font-medium'>
                  {formatCurrency(invoice.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
