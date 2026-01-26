'use client';

import { IconTrendingUp } from '@tabler/icons-react';
import { Area, AreaChart, CartesianGrid, XAxis } from 'recharts';
import * as React from 'react';
import { useInvoicesByMonth } from '../hooks/use-dashboard-stats';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';

const chartConfig = {
  invoices: {
    label: 'Invoices'
  },
  count: {
    label: 'Invoice Count',
    color: 'var(--primary)'
  }
} satisfies ChartConfig;

export function AreaGraph() {
  const { data: invoicesByMonth = {}, isLoading } = useInvoicesByMonth();

  const chartData = React.useMemo(() => {
    const entries = Object.entries(invoicesByMonth);
    // Sort by month and take last 6 months
    const sorted = entries
      .map(([month, count]) => ({ month, count: count as number }))
      .sort((a, b) => {
        const dateA = new Date(a.month);
        const dateB = new Date(b.month);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(-6);

    return sorted;
  }, [invoicesByMonth]);

  const totalInvoices = React.useMemo(
    () => chartData.reduce((acc, curr) => acc + curr.count, 0),
    [chartData]
  );

  const growth = React.useMemo(() => {
    if (chartData.length < 2) return 0;
    const lastMonth = chartData[chartData.length - 1].count;
    const prevMonth = chartData[chartData.length - 2].count;
    if (prevMonth === 0) return lastMonth > 0 ? 100 : 0;
    return ((lastMonth - prevMonth) / prevMonth) * 100;
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Invoices by Month</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
          <div className='text-muted-foreground flex aspect-auto h-[250px] w-full items-center justify-center'>
            Loading chart data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Invoices by Month</CardTitle>
          <CardDescription>No invoice data available</CardDescription>
        </CardHeader>
        <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
          <div className='text-muted-foreground flex aspect-auto h-[250px] w-full items-center justify-center'>
            No invoice data to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Invoices by Month</CardTitle>
        <CardDescription>
          Showing invoice count for the last 6 months
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <AreaChart
            data={chartData}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <defs>
              <linearGradient id='fillCount' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='5%'
                  stopColor='var(--color-count)'
                  stopOpacity={1.0}
                />
                <stop
                  offset='95%'
                  stopColor='var(--color-count)'
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='month'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', { month: 'short' });
              }}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator='dot' />}
            />
            <Area
              dataKey='count'
              type='natural'
              fill='url(#fillCount)'
              stroke='var(--color-count)'
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <CardFooter>
        <div className='flex w-full items-start gap-2 text-sm'>
          <div className='grid gap-2'>
            <div className='flex items-center gap-2 leading-none font-medium'>
              {growth >= 0 ? 'Trending up' : 'Trending down'} by{' '}
              {Math.abs(growth).toFixed(1)}% this month{' '}
              {growth >= 0 && <IconTrendingUp className='h-4 w-4' />}
            </div>
            <div className='text-muted-foreground flex items-center gap-2 leading-none'>
              {chartData.length > 0 && (
                <>
                  {new Date(chartData[0].month).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}{' '}
                  -{' '}
                  {new Date(
                    chartData[chartData.length - 1].month
                  ).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric'
                  })}
                </>
              )}
            </div>
          </div>
        </div>
      </CardFooter>
    </Card>
  );
}
