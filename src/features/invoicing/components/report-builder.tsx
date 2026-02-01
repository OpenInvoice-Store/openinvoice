'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  IconDownload,
  IconFile,
  IconFileSpreadsheet
} from '@tabler/icons-react';
import { useCustomers } from '../hooks/use-customers';
import {
  useGenerateReport,
  useExportReport,
  type ReportParams
} from '../hooks/use-reports';
import { ReportResults } from './report-results';

const reportSchema = z.object({
  reportType: z.enum([
    'invoices',
    'payments',
    'customers',
    'products',
    'revenue'
  ]),
  dateRange: z.enum([
    'all',
    'today',
    'week',
    'month',
    'quarter',
    'year',
    'custom'
  ]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
  customerId: z.string().optional(),
  groupBy: z
    .enum(['none', 'customer', 'status', 'month', 'product'])
    .optional(),
  includeItems: z.boolean(),
  includePayments: z.boolean()
});

type ReportFormData = z.infer<typeof reportSchema>;

// Helper function to calculate date range
function calculateDateRange(
  dateRange: string,
  startDate?: string,
  endDate?: string
): { startDate?: string; endDate?: string } {
  let calculatedStartDate: Date | undefined;
  let calculatedEndDate: Date | undefined;

  if (dateRange === 'custom') {
    if (startDate) calculatedStartDate = new Date(startDate);
    if (endDate) calculatedEndDate = new Date(endDate);
  } else if (dateRange !== 'all') {
    calculatedEndDate = new Date();
    calculatedStartDate = new Date();

    switch (dateRange) {
      case 'today':
        calculatedStartDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        calculatedStartDate.setDate(calculatedStartDate.getDate() - 7);
        break;
      case 'month':
        calculatedStartDate.setMonth(calculatedStartDate.getMonth() - 1);
        break;
      case 'quarter':
        calculatedStartDate.setMonth(calculatedStartDate.getMonth() - 3);
        break;
      case 'year':
        calculatedStartDate.setFullYear(calculatedStartDate.getFullYear() - 1);
        break;
    }
  }

  return {
    startDate: calculatedStartDate?.toISOString(),
    endDate: calculatedEndDate?.toISOString()
  };
}

export function ReportBuilder() {
  const [reportData, setReportData] = useState<any>(null);
  const { data: customers } = useCustomers();
  const generateReport = useGenerateReport();
  const exportReport = useExportReport();

  const form = useForm<ReportFormData>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reportType: 'invoices',
      dateRange: 'month',
      groupBy: 'none',
      includeItems: false,
      includePayments: false
    }
  });

  const dateRange = form.watch('dateRange');
  const reportType = form.watch('reportType');

  const onSubmit = async (data: ReportFormData) => {
    try {
      const { startDate, endDate } = calculateDateRange(
        data.dateRange,
        data.startDate,
        data.endDate
      );

      const params: ReportParams = {
        reportType: data.reportType,
        startDate,
        endDate,
        status: data.status,
        customerId: data.customerId,
        groupBy: data.groupBy || 'none',
        includeItems: data.includeItems,
        includePayments: data.includePayments
      };

      const result = await generateReport.mutateAsync(params);
      setReportData(result);
    } catch (error) {
      // Error is handled by the hook
      console.error('Report generation error:', error);
    }
  };

  const handleExport = async (format: 'csv' | 'xlsx') => {
    if (!reportData) {
      return;
    }

    try {
      const formData = form.getValues();
      const { startDate, endDate } = calculateDateRange(
        formData.dateRange,
        formData.startDate,
        formData.endDate
      );

      const params: ReportParams = {
        reportType: formData.reportType,
        startDate,
        endDate,
        status: formData.status,
        customerId: formData.customerId,
        groupBy: formData.groupBy || 'none',
        includeItems: formData.includeItems,
        includePayments: formData.includePayments
      };

      const blob = await exportReport.mutateAsync({ params, format });

      // Download the blob
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const filename = `report-${new Date().toISOString().split('T')[0]}.${
        format === 'xlsx' ? 'xlsx' : 'csv'
      }`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      // Error is handled by the hook
      console.error('Export error:', error);
    }
  };

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
          <CardDescription>
            Configure your report parameters and generate custom reports
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form form={form} onSubmit={form.handleSubmit(onSubmit)}>
            <div className='space-y-6'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='reportType'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Report Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='invoices'>Invoices</SelectItem>
                          <SelectItem value='payments'>Payments</SelectItem>
                          <SelectItem value='customers'>Customers</SelectItem>
                          <SelectItem value='products'>Products</SelectItem>
                          <SelectItem value='revenue'>
                            Revenue Analysis
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Select the type of data to include in the report
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='dateRange'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date Range</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='all'>All Time</SelectItem>
                          <SelectItem value='today'>Today</SelectItem>
                          <SelectItem value='week'>Last 7 Days</SelectItem>
                          <SelectItem value='month'>Last Month</SelectItem>
                          <SelectItem value='quarter'>Last Quarter</SelectItem>
                          <SelectItem value='year'>Last Year</SelectItem>
                          <SelectItem value='custom'>Custom Range</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {dateRange === 'custom' && (
                <div className='grid grid-cols-2 gap-4'>
                  <FormField
                    control={form.control}
                    name='startDate'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type='date' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name='endDate'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type='date' {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {(reportType === 'invoices' || reportType === 'payments') && (
                <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                  <FormField
                    control={form.control}
                    name='status'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status Filter</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === 'all' ? undefined : value)
                          }
                          value={field.value || 'all'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='All statuses' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='all'>All Statuses</SelectItem>
                            <SelectItem value='draft'>Draft</SelectItem>
                            <SelectItem value='sent'>Sent</SelectItem>
                            <SelectItem value='paid'>Paid</SelectItem>
                            <SelectItem value='overdue'>Overdue</SelectItem>
                            <SelectItem value='cancelled'>Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='customerId'
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Filter</FormLabel>
                        <Select
                          onValueChange={(value) =>
                            field.onChange(value === 'all' ? undefined : value)
                          }
                          value={field.value || 'all'}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder='All customers' />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value='all'>All Customers</SelectItem>
                            {customers?.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <FormField
                control={form.control}
                name='groupBy'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group By</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='none'>No Grouping</SelectItem>
                        <SelectItem value='customer'>Customer</SelectItem>
                        <SelectItem value='status'>Status</SelectItem>
                        <SelectItem value='month'>Month</SelectItem>
                        {reportType === 'invoices' && (
                          <SelectItem value='product'>Product</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Group results by this field for better analysis
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {reportType === 'invoices' && (
                <div className='space-y-4'>
                  <FormField
                    control={form.control}
                    name='includeItems'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                        <FormControl>
                          <input
                            type='checkbox'
                            checked={field.value}
                            onChange={field.onChange}
                            className='h-4 w-4 rounded border-gray-300'
                          />
                        </FormControl>
                        <div className='space-y-1 leading-none'>
                          <FormLabel>Include Invoice Items</FormLabel>
                          <FormDescription>
                            Include detailed line items in the report
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name='includePayments'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-start space-y-0 space-x-3 rounded-md border p-4'>
                        <FormControl>
                          <input
                            type='checkbox'
                            checked={field.value}
                            onChange={field.onChange}
                            className='h-4 w-4 rounded border-gray-300'
                          />
                        </FormControl>
                        <div className='space-y-1 leading-none'>
                          <FormLabel>Include Payment Details</FormLabel>
                          <FormDescription>
                            Include payment information in the report
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className='flex gap-2'>
                <Button type='submit' disabled={generateReport.isPending}>
                  {generateReport.isPending
                    ? 'Generating...'
                    : 'Generate Report'}
                </Button>
                {reportData && (
                  <>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => handleExport('csv')}
                    >
                      <IconFile className='mr-2 h-4 w-4' />
                      Export CSV
                    </Button>
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() => handleExport('xlsx')}
                    >
                      <IconFileSpreadsheet className='mr-2 h-4 w-4' />
                      Export Excel
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Form>
        </CardContent>
      </Card>

      {reportData && (
        <ReportResults data={reportData} reportType={reportType} />
      )}
    </div>
  );
}
