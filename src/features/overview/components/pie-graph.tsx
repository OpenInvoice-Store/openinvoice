'use client';

import * as React from 'react';
import { IconTrendingUp } from '@tabler/icons-react';
import { Label, Pie, PieChart } from 'recharts';
import { useInvoiceStatusCounts } from '../hooks/use-dashboard-stats';

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

const statusConfig: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'hsl(142, 76%, 36%)' },
  sent: { label: 'Sent', color: 'hsl(217, 91%, 60%)' },
  draft: { label: 'Draft', color: 'hsl(215, 16%, 47%)' },
  overdue: { label: 'Overdue', color: 'hsl(0, 84%, 60%)' },
  cancelled: { label: 'Cancelled', color: 'hsl(215, 28%, 17%)' }
};

const chartConfig = {
  invoices: {
    label: 'Invoices'
  },
  paid: {
    label: 'Paid',
    color: statusConfig.paid.color
  },
  sent: {
    label: 'Sent',
    color: statusConfig.sent.color
  },
  draft: {
    label: 'Draft',
    color: statusConfig.draft.color
  },
  overdue: {
    label: 'Overdue',
    color: statusConfig.overdue.color
  },
  cancelled: {
    label: 'Cancelled',
    color: statusConfig.cancelled.color
  }
} satisfies ChartConfig;

export function PieGraph() {
  const { data: invoiceCounts = {}, isLoading } = useInvoiceStatusCounts();

  const chartData = React.useMemo(() => {
    const statuses = ['paid', 'sent', 'draft', 'overdue', 'cancelled'] as const;
    return statuses
      .filter((status) => invoiceCounts[status] > 0)
      .map((status, index) => ({
        status,
        count: invoiceCounts[status] || 0,
        fill: statusConfig[status]?.color || 'var(--primary)',
        label: statusConfig[status]?.label || status
      }));
  }, [invoiceCounts]);

  const totalInvoices = React.useMemo(() => {
    return chartData.reduce((acc, curr) => acc + curr.count, 0);
  }, [chartData]);

  const topStatus = React.useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData.reduce((prev, curr) =>
      curr.count > prev.count ? curr : prev
    );
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Invoice Status Distribution</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
          <div className='text-muted-foreground mx-auto flex aspect-square h-[250px] items-center justify-center'>
            Loading chart data...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalInvoices === 0) {
    return (
      <Card className='@container/card'>
        <CardHeader>
          <CardTitle>Invoice Status Distribution</CardTitle>
          <CardDescription>No invoices available</CardDescription>
        </CardHeader>
        <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
          <div className='text-muted-foreground mx-auto flex aspect-square h-[250px] items-center justify-center'>
            No invoice data to display
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='@container/card'>
      <CardHeader>
        <CardTitle>Invoice Status Distribution</CardTitle>
        <CardDescription>
          <span className='hidden @[540px]/card:block'>
            Distribution of invoices by status
          </span>
          <span className='@[540px]/card:hidden'>Status distribution</span>
        </CardDescription>
      </CardHeader>
      <CardContent className='px-2 pt-4 sm:px-6 sm:pt-6'>
        <ChartContainer
          config={chartConfig}
          className='mx-auto aspect-square h-[250px]'
        >
          <PieChart>
            <defs>
              {chartData.map((item, index) => (
                <linearGradient
                  key={item.status}
                  id={`fill${item.status}`}
                  x1='0'
                  y1='0'
                  x2='0'
                  y2='1'
                >
                  <stop
                    offset='0%'
                    stopColor={item.fill}
                    stopOpacity={1 - index * 0.1}
                  />
                  <stop
                    offset='100%'
                    stopColor={item.fill}
                    stopOpacity={0.8 - index * 0.1}
                  />
                </linearGradient>
              ))}
            </defs>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData.map((item) => ({
                ...item,
                fill: `url(#fill${item.status})`
              }))}
              dataKey='count'
              nameKey='label'
              innerRadius={60}
              strokeWidth={2}
              stroke='var(--background)'
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor='middle'
                        dominantBaseline='middle'
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className='fill-foreground text-3xl font-bold'
                        >
                          {totalInvoices.toLocaleString()}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className='fill-muted-foreground text-sm'
                        >
                          Total Invoices
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
      <CardFooter className='flex-col gap-2 text-sm'>
        {topStatus && (
          <>
            <div className='flex items-center gap-2 leading-none font-medium'>
              {topStatus.label} leads with{' '}
              {((topStatus.count / totalInvoices) * 100).toFixed(1)}%{' '}
              <IconTrendingUp className='h-4 w-4' />
            </div>
            <div className='text-muted-foreground leading-none'>
              {topStatus.count} invoice{topStatus.count !== 1 ? 's' : ''} with{' '}
              {topStatus.label.toLowerCase()} status
            </div>
          </>
        )}
      </CardFooter>
    </Card>
  );
}
