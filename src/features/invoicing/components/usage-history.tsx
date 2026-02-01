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
import { useUsageRecords } from '../hooks/use-recurring-invoices';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/format';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface UsageHistoryProps {
  templateId: string;
  usageUnit?: string | null;
}

export function UsageHistory({ templateId, usageUnit }: UsageHistoryProps) {
  const { data: usageRecords, isLoading } = useUsageRecords(templateId);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground text-sm'>Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (!usageRecords || usageRecords.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage History</CardTitle>
          <CardDescription>
            No usage records found. Record usage to generate invoices.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground py-8 text-center text-sm'>
            No usage data recorded yet
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate totals
  const totalUsage = usageRecords.reduce(
    (sum, record) => sum + record.quantity,
    0
  );
  const billedUsage = usageRecords
    .filter((r) => r.invoiceId)
    .reduce((sum, record) => sum + record.quantity, 0);
  const unbilledUsage = totalUsage - billedUsage;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage History</CardTitle>
        <CardDescription>
          {usageRecords.length} usage record
          {usageRecords.length !== 1 ? 's' : ''} recorded
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='mb-4 grid grid-cols-3 gap-4'>
          <div className='rounded-lg border p-3'>
            <div className='text-muted-foreground text-xs font-medium'>
              Total Usage
            </div>
            <div className='text-lg font-semibold'>
              {totalUsage.toLocaleString()} {usageUnit || 'units'}
            </div>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='text-muted-foreground text-xs font-medium'>
              Billed
            </div>
            <div className='text-lg font-semibold text-green-600'>
              {billedUsage.toLocaleString()} {usageUnit || 'units'}
            </div>
          </div>
          <div className='rounded-lg border p-3'>
            <div className='text-muted-foreground text-xs font-medium'>
              Unbilled
            </div>
            <div className='text-lg font-semibold text-orange-600'>
              {unbilledUsage.toLocaleString()} {usageUnit || 'units'}
            </div>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead className='text-right'>Quantity</TableHead>
              <TableHead>Recorded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='text-right'>Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usageRecords.map((record) => (
              <TableRow key={record.id}>
                <TableCell>
                  <div className='text-sm'>
                    {format(new Date(record.periodStart), 'MMM d, yyyy')} -{' '}
                    {format(new Date(record.periodEnd), 'MMM d, yyyy')}
                  </div>
                </TableCell>
                <TableCell className='text-right font-medium'>
                  {record.quantity.toLocaleString()} {usageUnit || 'units'}
                </TableCell>
                <TableCell>
                  <div className='text-muted-foreground text-sm'>
                    {format(new Date(record.recordedAt), 'MMM d, yyyy')}
                  </div>
                </TableCell>
                <TableCell>
                  {record.invoiceId ? (
                    <Badge variant='default' className='bg-green-600'>
                      Billed
                    </Badge>
                  ) : (
                    <Badge
                      variant='outline'
                      className='border-orange-600 text-orange-600'
                    >
                      Unbilled
                    </Badge>
                  )}
                </TableCell>
                <TableCell className='text-right'>
                  {record.invoiceId ? (
                    <Button variant='ghost' size='sm' asChild>
                      <Link href={`/dashboard/invoices/${record.invoiceId}`}>
                        View Invoice
                      </Link>
                    </Button>
                  ) : (
                    <span className='text-muted-foreground text-sm'>-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
