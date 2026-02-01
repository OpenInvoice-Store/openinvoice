'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/format';

interface ReportResultsProps {
  data: any;
  reportType: string;
}

export function ReportResults({ data, reportType }: ReportResultsProps) {
  if (!data || !data.results || data.results.length === 0) {
    return (
      <Card>
        <CardContent className='text-muted-foreground py-8 text-center'>
          No data found for the selected criteria
        </CardContent>
      </Card>
    );
  }

  const renderSummary = () => {
    if (!data.summary) return null;

    return (
      <div className='mb-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
        {data.summary.totalRevenue && (
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className='text-2xl'>
                {formatCurrency(data.summary.totalRevenue)}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
        {data.summary.totalCount !== undefined && (
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total Count</CardDescription>
              <CardTitle className='text-2xl'>
                {data.summary.totalCount}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
        {data.summary.averageAmount && (
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Average Amount</CardDescription>
              <CardTitle className='text-2xl'>
                {formatCurrency(data.summary.averageAmount)}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
      </div>
    );
  };

  const renderTable = () => {
    const results = data.results || [];
    const grouped = data.grouped || false;

    if (grouped) {
      // Render grouped data
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead>
              <TableHead className='text-right'>Count</TableHead>
              <TableHead className='text-right'>Total Amount</TableHead>
              <TableHead className='text-right'>Average</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((group: any, index: number) => (
              <TableRow key={index}>
                <TableCell className='font-medium'>
                  {group.group || 'N/A'}
                </TableCell>
                <TableCell className='text-right'>{group.count || 0}</TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(group.total || 0)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(group.average || 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Render regular invoice data
    if (reportType === 'invoices') {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Total</TableHead>
              <TableHead className='text-right'>Paid</TableHead>
              <TableHead className='text-right'>Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((invoice: any) => (
              <TableRow key={invoice.id}>
                <TableCell className='font-medium'>
                  #{invoice.invoiceNo}
                </TableCell>
                <TableCell>{invoice.customerName || '-'}</TableCell>
                <TableCell>{formatDate(invoice.issueDate)}</TableCell>
                <TableCell>{formatDate(invoice.dueDate)}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      invoice.status === 'paid'
                        ? 'bg-green-500'
                        : invoice.status === 'overdue'
                          ? 'bg-red-500'
                          : invoice.status === 'sent'
                            ? 'bg-blue-500'
                            : 'bg-gray-500'
                    }
                  >
                    {invoice.status}
                  </Badge>
                </TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(invoice.total || 0)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(invoice.totalPaid || 0)}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(invoice.balance || 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Render payment data
    if (reportType === 'payments') {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Invoice #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className='text-right'>Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((payment: any) => (
              <TableRow key={payment.id}>
                <TableCell>{formatDate(payment.date)}</TableCell>
                <TableCell className='font-medium'>
                  #{payment.invoiceNo || '-'}
                </TableCell>
                <TableCell>{payment.customerName || '-'}</TableCell>
                <TableCell>{payment.method || '-'}</TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(payment.amount || 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Render customer data
    if (reportType === 'customers') {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className='text-right'>Total Invoices</TableHead>
              <TableHead className='text-right'>Total Revenue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((customer: any) => (
              <TableRow key={customer.id}>
                <TableCell className='font-medium'>{customer.name}</TableCell>
                <TableCell>{customer.email || '-'}</TableCell>
                <TableCell className='text-right'>
                  {customer.totalInvoices || 0}
                </TableCell>
                <TableCell className='text-right'>
                  {formatCurrency(customer.totalRevenue || 0)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Render product data
    if (reportType === 'products') {
      return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className='text-right'>Tax Rate</TableHead>
              <TableHead className='text-right'>Times Used</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((product: any) => (
              <TableRow key={product.id}>
                <TableCell className='font-medium'>{product.name}</TableCell>
                <TableCell>{formatCurrency(product.price || 0)}</TableCell>
                <TableCell className='text-right'>
                  {product.taxRate || 0}%
                </TableCell>
                <TableCell className='text-right'>
                  {product.timesUsed || 0}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Default render for revenue analysis
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Period</TableHead>
            <TableHead className='text-right'>Revenue</TableHead>
            <TableHead className='text-right'>Count</TableHead>
            <TableHead className='text-right'>Average</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {results.map((item: any, index: number) => (
            <TableRow key={index}>
              <TableCell className='font-medium'>
                {item.period || 'N/A'}
              </TableCell>
              <TableCell className='text-right'>
                {formatCurrency(item.revenue || 0)}
              </TableCell>
              <TableCell className='text-right'>{item.count || 0}</TableCell>
              <TableCell className='text-right'>
                {formatCurrency(item.average || 0)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Report Results</CardTitle>
        <CardDescription>
          {data.results.length} record{data.results.length !== 1 ? 's' : ''}{' '}
          found
        </CardDescription>
      </CardHeader>
      <CardContent>
        {renderSummary()}
        <div className='rounded-md border'>{renderTable()}</div>
      </CardContent>
    </Card>
  );
}
