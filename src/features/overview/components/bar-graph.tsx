'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/format';

export const description = 'Invoice revenue over time';

async function fetchRevenueData() {
  const res = await fetch('/api/dashboard/stats');
  if (!res.ok) throw new Error('Failed to fetch revenue data');
  const data = await res.json();
  return data.revenueByDay || {};
}

const chartConfig = {
  revenue: {
    label: 'Revenue',
    color: 'var(--primary)'
  }
} satisfies ChartConfig;

export function BarGraph() {
  const { data: revenueByDay = {}, isLoading } = useQuery({
    queryKey: ['revenueByDay'],
    queryFn: fetchRevenueData,
  });

  const chartData = React.useMemo(() => {
    const entries = Object.entries(revenueByDay);
    // Sort by date and get last 30 days
    const sorted = entries
      .map(([date, revenue]) => ({ date, revenue: revenue as number }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
    
    return sorted;
  }, [revenueByDay]);

  const totalRevenue = React.useMemo(
    () => chartData.reduce((acc, curr) => acc + curr.revenue, 0),
    [chartData]
  );

  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || isLoading) {
    return (
      <Card className='@container/card !pt-3'>
        <CardHeader className='flex flex-col items-stretch space-y-0 border-b !p-0 sm:flex-row'>
          <div className='flex flex-1 flex-col justify-center gap-1 px-6 !py-0'>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>Loading...</CardDescription>
          </div>
        </CardHeader>
        <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
          <div className='aspect-auto h-[250px] w-full flex items-center justify-center text-muted-foreground'>
            Loading chart data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className='@container/card !pt-3'>
        <CardHeader className='flex flex-col items-stretch space-y-0 border-b !p-0 sm:flex-row'>
          <div className='flex flex-1 flex-col justify-center gap-1 px-6 !py-0'>
            <CardTitle>Revenue Over Time</CardTitle>
            <CardDescription>No revenue data available</CardDescription>
          </div>
        </CardHeader>
        <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
          <div className='aspect-auto h-[250px] w-full flex items-center justify-center text-muted-foreground'>
            No invoice data to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='@container/card !pt-3'>
      <CardHeader className='flex flex-col items-stretch space-y-0 border-b !p-0 sm:flex-row'>
        <div className='flex flex-1 flex-col justify-center gap-1 px-6 !py-0'>
          <CardTitle>Revenue Over Time</CardTitle>
          <CardDescription>
            <span className='hidden @[540px]/card:block'>
              Daily invoice revenue for the last 30 days
            </span>
            <span className='@[540px]/card:hidden'>Last 30 days</span>
          </CardDescription>
        </div>
        <div className='flex'>
          <div className='relative flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left sm:border-t-0 sm:border-l sm:px-8 sm:py-6'>
            <span className='text-muted-foreground text-xs'>
              {chartConfig.revenue.label}
            </span>
            <span className='text-lg leading-none font-bold sm:text-3xl'>
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='aspect-auto h-[250px] w-full'
        >
          <BarChart
            data={chartData}
            margin={{
              left: 12,
              right: 12
            }}
          >
            <defs>
              <linearGradient id='fillBar' x1='0' y1='0' x2='0' y2='1'>
                <stop
                  offset='0%'
                  stopColor='var(--primary)'
                  stopOpacity={0.8}
                />
                <stop
                  offset='100%'
                  stopColor='var(--primary)'
                  stopOpacity={0.2}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey='date'
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });
              }}
            />
            <ChartTooltip
              cursor={{ fill: 'var(--primary)', opacity: 0.1 }}
              content={
                <ChartTooltipContent
                  className='w-[150px]'
                  nameKey='revenue'
                  formatter={(value) => formatCurrency(Number(value))}
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    });
                  }}
                />
              }
            />
            <Bar
              dataKey='revenue'
              fill='url(#fillBar)'
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
