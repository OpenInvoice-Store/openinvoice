'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { IconUsers, IconTrendingUp, IconAward } from '@tabler/icons-react';
import { useCustomerLifetimeValue } from '../hooks/use-analytics';

interface CLVMetrics {
  totalRevenue: number;
  paidRevenue: number;
  avgOrderValue: number;
  purchaseFrequency: number;
  customerAge: number;
  customerAgeYears: number;
  totalInvoices: number;
  paidInvoices: number;
  activeRecurringTemplates: number;
}

interface CLVData {
  historical: number;
  projectedFuture: number;
  total: number;
  predicted12Months: number;
}

interface CustomerCLV {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  metrics: CLVMetrics;
  clv: CLVData;
  valueScore: number;
  segment: string;
}

interface CLVSummary {
  totalCustomers: number;
  totalCLV: number;
  avgCLV: number;
  highValueCount: number;
  mediumValueCount: number;
  lowValueCount: number;
}

export function CustomerLifetimeValue() {
  const { data, isLoading, error } = useCustomerLifetimeValue();

  if (error) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <p className='text-destructive'>Error loading CLV data</p>
        </CardContent>
      </Card>
    );
  }

  const getSegmentColor = (segment: string) => {
    switch (segment) {
      case 'High Value':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'Medium Value':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconUsers className='h-5 w-5' />
            Customer Lifetime Value Analysis
          </CardTitle>
          <CardDescription>
            Analyze customer value based on historical revenue and future
            projections
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-4'>
                <Skeleton className='h-24' />
                <Skeleton className='h-24' />
                <Skeleton className='h-24' />
                <Skeleton className='h-24' />
              </div>
              <Skeleton className='h-[400px] w-full' />
            </div>
          ) : data ? (
            <>
              <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-4'>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Total CLV
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${data.summary.totalCLV.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Across all customers
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Average CLV
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${data.summary.avgCLV.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Per customer
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                      <IconAward className='h-4 w-4 text-green-500' />
                      High Value
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      {data.summary.highValueCount}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Customers (CLV {'>'} $50k)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Medium Value
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      {data.summary.mediumValueCount}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Customers ($10k - $50k)
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className='mt-6'>
                <h3 className='mb-3 text-sm font-semibold'>
                  Customer Rankings
                </h3>
                <div className='rounded-lg border'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Total CLV</TableHead>
                        <TableHead>Historical</TableHead>
                        <TableHead>Projected</TableHead>
                        <TableHead>12M Predicted</TableHead>
                        <TableHead>Value Score</TableHead>
                        <TableHead>Segment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.customers.slice(0, 20).map((customer, index) => (
                        <TableRow key={customer.customerId}>
                          <TableCell className='font-medium'>
                            #{index + 1}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className='font-medium'>
                                {customer.customerName}
                              </div>
                              {customer.customerEmail && (
                                <div className='text-muted-foreground text-xs'>
                                  {customer.customerEmail}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='font-semibold'>
                              ${customer.clv.total.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='text-sm'>
                              ${customer.clv.historical.toLocaleString()}
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {customer.metrics.totalInvoices} invoices
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='text-sm'>
                              ${customer.clv.projectedFuture.toLocaleString()}
                            </div>
                            <div className='text-muted-foreground text-xs'>
                              {customer.metrics.activeRecurringTemplates}{' '}
                              recurring
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='text-sm font-medium'>
                              ${customer.clv.predicted12Months.toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className='flex items-center gap-2'>
                              <div className='text-sm font-medium'>
                                {customer.valueScore}
                              </div>
                              {customer.valueScore >= 70 && (
                                <IconTrendingUp className='h-4 w-4 text-green-500' />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={getSegmentColor(customer.segment)}
                            >
                              {customer.segment}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {data.customers.length > 20 && (
                  <p className='text-muted-foreground mt-4 text-center text-sm'>
                    Showing top 20 customers. Total: {data.customers.length}
                  </p>
                )}
              </div>

              <div className='mt-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Metrics Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Avg Order Value:
                      </span>
                      <span className='font-medium'>
                        $
                        {data.customers.length > 0
                          ? (
                              data.customers.reduce(
                                (sum, c) => sum + c.metrics.avgOrderValue,
                                0
                              ) / data.customers.length
                            ).toLocaleString()
                          : '0'}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Avg Purchase Frequency:
                      </span>
                      <span className='font-medium'>
                        {data.customers.length > 0
                          ? (
                              data.customers.reduce(
                                (sum, c) => sum + c.metrics.purchaseFrequency,
                                0
                              ) / data.customers.length
                            ).toFixed(1)
                          : '0'}{' '}
                        /year
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Avg Customer Age:
                      </span>
                      <span className='font-medium'>
                        {data.customers.length > 0
                          ? (
                              data.customers.reduce(
                                (sum, c) => sum + c.metrics.customerAgeYears,
                                0
                              ) / data.customers.length
                            ).toFixed(1)
                          : '0'}{' '}
                        years
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Revenue Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-2 text-sm'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Total Historical:
                      </span>
                      <span className='font-medium'>
                        $
                        {data.customers
                          .reduce((sum, c) => sum + c.metrics.totalRevenue, 0)
                          .toLocaleString()}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>Total Paid:</span>
                      <span className='font-medium'>
                        $
                        {data.customers
                          .reduce((sum, c) => sum + c.metrics.paidRevenue, 0)
                          .toLocaleString()}
                      </span>
                    </div>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>
                        Total Projected:
                      </span>
                      <span className='font-medium'>
                        $
                        {data.customers
                          .reduce((sum, c) => sum + c.clv.projectedFuture, 0)
                          .toLocaleString()}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Customer Segments
                    </CardTitle>
                  </CardHeader>
                  <CardContent className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <Badge className={getSegmentColor('High Value')}>
                        High Value
                      </Badge>
                      <span className='text-sm font-medium'>
                        {data.summary.highValueCount} (
                        {data.summary.totalCustomers > 0
                          ? Math.round(
                              (data.summary.highValueCount /
                                data.summary.totalCustomers) *
                                100
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <Badge className={getSegmentColor('Medium Value')}>
                        Medium Value
                      </Badge>
                      <span className='text-sm font-medium'>
                        {data.summary.mediumValueCount} (
                        {data.summary.totalCustomers > 0
                          ? Math.round(
                              (data.summary.mediumValueCount /
                                data.summary.totalCustomers) *
                                100
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                    <div className='flex items-center justify-between'>
                      <Badge className={getSegmentColor('Low Value')}>
                        Low Value
                      </Badge>
                      <span className='text-sm font-medium'>
                        {data.summary.lowValueCount} (
                        {data.summary.totalCustomers > 0
                          ? Math.round(
                              (data.summary.lowValueCount /
                                data.summary.totalCustomers) *
                                100
                            )
                          : 0}
                        %)
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
