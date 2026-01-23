'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Card,
  CardHeader,
  CardContent,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/format';

async function fetchRecentInvoices() {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) throw new Error('Failed to fetch recent invoices');
  const data = await res.json();
  return data.recentInvoices || [];
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function RecentSales() {
  const { data: recentInvoices = [], isLoading } = useQuery({
    queryKey: ['recentInvoices'],
    queryFn: fetchRecentInvoices,
  });

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
                <div className='h-9 w-9 rounded-full bg-muted animate-pulse' />
                <div className='ml-4 space-y-2 flex-1'>
                  <div className='h-4 w-24 bg-muted rounded animate-pulse' />
                  <div className='h-3 w-32 bg-muted rounded animate-pulse' />
                </div>
                <div className='h-4 w-16 bg-muted rounded animate-pulse' />
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
          <div className='text-center py-8 text-muted-foreground'>
            No invoices to display
          </div>
        ) : (
          <div className='space-y-8'>
            {recentInvoices.map((invoice: any) => (
              <div key={invoice.id} className='flex items-center'>
                <Avatar className='h-9 w-9'>
                  <AvatarFallback>{getInitials(invoice.customerName)}</AvatarFallback>
                </Avatar>
                <div className='ml-4 space-y-1'>
                  <p className='text-sm leading-none font-medium'>{invoice.customerName}</p>
                  <p className='text-muted-foreground text-sm'>
                    Invoice #{invoice.invoiceNo} {invoice.customerEmail ? `• ${invoice.customerEmail}` : ''}
                  </p>
                </div>
                <div className='ml-auto font-medium'>{formatCurrency(invoice.amount)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
