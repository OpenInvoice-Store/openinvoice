import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter
} from '@/components/ui/card';
import { IconTrendingDown, IconTrendingUp } from '@tabler/icons-react';
import React from 'react';
import { formatCurrency } from '@/lib/format';
import { prisma } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

function calculateInvoiceTotal(invoice: any): number {
  const subtotal = invoice.items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );
  const tax = invoice.items.reduce(
    (sum: number, item: any) =>
      sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  return subtotal + tax;
}

async function getDashboardStats() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      // Return empty stats if no organization
      return {
        totalRevenue: 0,
        paidRevenue: 0,
        totalCustomers: 0,
        uniqueCustomersWithInvoices: 0,
        invoiceCounts: {
          total: 0,
          draft: 0,
          sent: 0,
          paid: 0,
          overdue: 0,
          cancelled: 0
        },
        revenueGrowth: 0
      };
    }

    // Get all invoices with items for this organization
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId
      } as any,
      include: {
        items: true,
        payments: true,
        customer: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate total revenue
    const totalRevenue = invoices.reduce((sum, invoice) => {
      return sum + calculateInvoiceTotal(invoice);
    }, 0);

    // Calculate paid revenue
    const paidRevenue = invoices.reduce((sum, invoice) => {
      if (invoice.status === 'paid' || invoice.payments.length > 0) {
        const paidAmount = invoice.payments.reduce(
          (total: number, payment: any) => total + payment.amount,
          0
        );
        return sum + (paidAmount || calculateInvoiceTotal(invoice));
      }
      return sum;
    }, 0);

    // Count unique customers
    const uniqueCustomers = new Set(invoices.map((inv) => inv.customerId)).size;
    const totalCustomers = await prisma.customer.count({
      where: { organizationId: orgId } as any
    });

    // Count invoices by status
    const invoiceCounts = {
      total: invoices.length,
      draft: invoices.filter((inv) => inv.status === 'draft').length,
      sent: invoices.filter((inv) => inv.status === 'sent').length,
      paid: invoices.filter((inv) => inv.status === 'paid').length,
      overdue: invoices.filter((inv) => inv.status === 'overdue').length,
      cancelled: invoices.filter((inv) => inv.status === 'cancelled').length
    };

    // Calculate growth (compare this month vs last month)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthInvoices = invoices.filter(
      (inv) => new Date(inv.createdAt) >= currentMonthStart
    );
    const lastMonthInvoices = invoices.filter(
      (inv) =>
        new Date(inv.createdAt) >= lastMonthStart &&
        new Date(inv.createdAt) <= lastMonthEnd
    );

    const thisMonthRevenue = thisMonthInvoices.reduce(
      (sum, inv) => sum + calculateInvoiceTotal(inv),
      0
    );
    const lastMonthRevenue = lastMonthInvoices.reduce(
      (sum, inv) => sum + calculateInvoiceTotal(inv),
      0
    );

    const revenueGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

    return {
      totalRevenue,
      paidRevenue,
      totalCustomers,
      uniqueCustomersWithInvoices: uniqueCustomers,
      invoiceCounts,
      revenueGrowth
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalRevenue: 0,
      paidRevenue: 0,
      totalCustomers: 0,
      uniqueCustomersWithInvoices: 0,
      invoiceCounts: {
        total: 0,
        draft: 0,
        sent: 0,
        paid: 0,
        overdue: 0,
        cancelled: 0
      },
      revenueGrowth: 0
    };
  }
}

export default async function OverViewLayout({
  sales,
  pie_stats,
  bar_stats,
  area_stats
}: {
  sales: React.ReactNode;
  pie_stats: React.ReactNode;
  bar_stats: React.ReactNode;
  area_stats: React.ReactNode;
}) {
  const stats = await getDashboardStats();

  const revenueGrowthFormatted =
    stats.revenueGrowth >= 0
      ? `+${stats.revenueGrowth.toFixed(1)}%`
      : `${stats.revenueGrowth.toFixed(1)}%`;

  const isRevenueGrowing = stats.revenueGrowth >= 0;
  const RevenueIcon = isRevenueGrowing ? IconTrendingUp : IconTrendingDown;

  return (
    <PageContainer>
      <div className='flex flex-1 flex-col space-y-2'>
        <div className='flex items-center justify-between space-y-2'>
          <h2 className='text-2xl font-bold tracking-tight'>
            Hi, Welcome back 👋
          </h2>
        </div>

        <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs md:grid-cols-2 lg:grid-cols-4'>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {formatCurrency(stats.totalRevenue)}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <RevenueIcon className='h-3 w-3' />
                  {revenueGrowthFormatted}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {isRevenueGrowing
                  ? 'Trending up this month'
                  : 'Revenue decreased this month'}{' '}
                <RevenueIcon className='size-4' />
              </div>
              <div className='text-muted-foreground'>
                From all invoices in the system
              </div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Total Customers</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {stats.totalCustomers.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  {stats.uniqueCustomersWithInvoices} with invoices
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {stats.uniqueCustomersWithInvoices} customers have invoices
              </div>
              <div className='text-muted-foreground'>Customer database</div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Total Invoices</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {stats.invoiceCounts.total.toLocaleString()}
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>{stats.invoiceCounts.paid} paid</Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {stats.invoiceCounts.paid} paid, {stats.invoiceCounts.overdue}{' '}
                overdue
              </div>
              <div className='text-muted-foreground'>
                Invoice status overview
              </div>
            </CardFooter>
          </Card>
          <Card className='@container/card'>
            <CardHeader>
              <CardDescription>Revenue Growth</CardDescription>
              <CardTitle className='text-2xl font-semibold tabular-nums @[250px]/card:text-3xl'>
                {stats.revenueGrowth.toFixed(1)}%
              </CardTitle>
              <CardAction>
                <Badge variant='outline'>
                  <RevenueIcon className='h-3 w-3' />
                  {revenueGrowthFormatted}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className='flex-col items-start gap-1.5 text-sm'>
              <div className='line-clamp-1 flex gap-2 font-medium'>
                {isRevenueGrowing ? 'Revenue increased' : 'Revenue decreased'}{' '}
                this month <RevenueIcon className='size-4' />
              </div>
              <div className='text-muted-foreground'>
                Month-over-month comparison
              </div>
            </CardFooter>
          </Card>
        </div>
        <div className='grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-7'>
          <div className='col-span-4'>{bar_stats}</div>
          <div className='col-span-4 md:col-span-3'>
            {/* sales arallel routes */}
            {sales}
          </div>
          <div className='col-span-4'>{area_stats}</div>
          <div className='col-span-4 md:col-span-3'>{pie_stats}</div>
        </div>
      </div>
    </PageContainer>
  );
}
