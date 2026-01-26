'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  IconTrendingUp,
  IconTrendingDown,
  IconChartLine
} from '@tabler/icons-react';
import { useFinancialForecast } from '../hooks/use-analytics';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ForecastData {
  month: string;
  monthKey: string;
  projectedRevenue: number;
  recurringRevenue: number;
  trendRevenue: number;
  confidence: number;
}

interface ForecastSummary {
  totalProjected: number;
  avgMonthlyProjected: number;
  avgConfidence: number;
  activeRecurringTemplates: number;
  historicalAvgMonthly: number;
  trend: number;
}

export function FinancialForecasting() {
  const [period, setPeriod] = useState('12');

  const { data, isLoading, error } = useFinancialForecast(period);

  if (error) {
    return (
      <Card>
        <CardContent className='pt-6'>
          <p className='text-destructive'>Error loading forecast data</p>
        </CardContent>
      </Card>
    );
  }

  const chartData =
    data?.forecasts.map((f) => ({
      month: f.month,
      Projected: f.projectedRevenue,
      Recurring: f.recurringRevenue,
      Trend: f.trendRevenue
    })) || [];

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle className='flex items-center gap-2'>
                <IconChartLine className='h-5 w-5' />
                Financial Forecasting
              </CardTitle>
              <CardDescription>
                Projected revenue based on historical trends and recurring
                invoices
              </CardDescription>
            </div>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className='w-[180px]'>
                <SelectValue placeholder='Forecast period' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='3'>3 Months</SelectItem>
                <SelectItem value='6'>6 Months</SelectItem>
                <SelectItem value='12'>12 Months</SelectItem>
                <SelectItem value='24'>24 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className='space-y-4'>
              <Skeleton className='h-[300px] w-full' />
              <div className='grid grid-cols-3 gap-4'>
                <Skeleton className='h-24' />
                <Skeleton className='h-24' />
                <Skeleton className='h-24' />
              </div>
            </div>
          ) : data ? (
            <>
              <div className='mb-6'>
                <ResponsiveContainer width='100%' height={300}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 10, bottom: 100, left: 10 }}
                  >
                    <CartesianGrid strokeDasharray='3 3' />
                    <XAxis
                      dataKey='month'
                      angle={-45}
                      textAnchor='end'
                      height={100}
                      tick={{ fontSize: 11 }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number) =>
                        `$${value.toLocaleString()}`
                      }
                      labelStyle={{ color: '#000', fontSize: 12 }}
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line
                      type='monotone'
                      dataKey='Projected'
                      stroke='#3b82f6'
                      strokeWidth={2}
                      dot={{ r: 4 }}
                    />
                    <Line
                      type='monotone'
                      dataKey='Recurring'
                      stroke='#10b981'
                      strokeWidth={2}
                      strokeDasharray='5 5'
                    />
                    <Line
                      type='monotone'
                      dataKey='Trend'
                      stroke='#f59e0b'
                      strokeWidth={2}
                      strokeDasharray='3 3'
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Total Projected
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${data.summary.totalProjected.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Over {period} months
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Avg Monthly
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      ${data.summary.avgMonthlyProjected.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Average confidence: {data.summary.avgConfidence}%
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Active Recurring
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-2xl font-bold'>
                      {data.summary.activeRecurringTemplates}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Templates contributing to forecast
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='text-sm font-medium'>
                      Historical Average
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-xl font-semibold'>
                      ${data.summary.historicalAvgMonthly.toLocaleString()}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      Per month (last 6 months)
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className='pb-2'>
                    <CardTitle className='flex items-center gap-2 text-sm font-medium'>
                      Trend
                      {data.summary.trend > 0 ? (
                        <IconTrendingUp className='h-4 w-4 text-green-500' />
                      ) : (
                        <IconTrendingDown className='h-4 w-4 text-red-500' />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className='text-xl font-semibold'>
                      ${Math.abs(data.summary.trend).toLocaleString()}
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs'>
                      {data.summary.trend > 0 ? 'Growing' : 'Declining'} per
                      month
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className='mt-6'>
                <h3 className='mb-3 text-sm font-semibold'>
                  Monthly Forecast Details
                </h3>
                <div className='space-y-2'>
                  {data.forecasts.map((forecast) => (
                    <div
                      key={forecast.monthKey}
                      className='flex items-center justify-between rounded-lg border p-3'
                    >
                      <div className='flex-1'>
                        <div className='font-medium'>{forecast.month}</div>
                        <div className='text-muted-foreground text-sm'>
                          Recurring: $
                          {forecast.recurringRevenue.toLocaleString()} • Trend:{' '}
                          ${forecast.trendRevenue.toLocaleString()}
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='font-semibold'>
                          ${forecast.projectedRevenue.toLocaleString()}
                        </div>
                        <Badge
                          variant={
                            forecast.confidence >= 70
                              ? 'default'
                              : forecast.confidence >= 50
                                ? 'secondary'
                                : 'outline'
                          }
                          className='text-xs'
                        >
                          {forecast.confidence}% confidence
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
