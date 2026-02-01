'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  useRecurringInvoice,
  useGenerateRecurringInvoice
} from '@/features/invoicing/hooks/use-recurring-invoices';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { toast } from 'sonner';
import { IconPlayerPlay } from '@tabler/icons-react';

export default function RecurringInvoiceInvoicesPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const templateQuery = useRecurringInvoice(id);
  const { data: template, isLoading } = templateQuery;
  const generateInvoice = useGenerateRecurringInvoice();

  const handleGenerate = async () => {
    try {
      const result = await generateInvoice.mutateAsync(template!.id);
      toast.success(
        `Invoice #${result.invoice.invoiceNo} generated successfully`
      );
      router.push(`/dashboard/invoices/${result.invoice.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to generate invoice'
      );
    }
  };

  if (isLoading) {
    return <div className='text-muted-foreground p-4 text-sm'>Loading...</div>;
  }

  if (!template) {
    return (
      <div className='text-muted-foreground p-4 text-sm'>
        Template not found
      </div>
    );
  }

  const invoices = template.invoices || [];

  const statusColors: Record<
    string,
    {
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      className: string;
    }
  > = {
    paid: { variant: 'default', className: 'bg-green-600' },
    sent: { variant: 'secondary', className: '' },
    draft: { variant: 'outline', className: '' },
    overdue: {
      variant: 'destructive',
      className: 'bg-red-600'
    },
    cancelled: { variant: 'outline', className: '' }
  };

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <div className='flex items-center justify-between'>
            <div>
              <CardTitle>Generated Invoices</CardTitle>
              <CardDescription>
                {invoices.length} invoice
                {invoices.length !== 1 ? 's' : ''} created from this template
                {template._count &&
                  template._count.invoices > invoices.length && (
                    <span className='text-muted-foreground ml-2'>
                      (showing latest {invoices.length} of{' '}
                      {template._count.invoices})
                    </span>
                  )}
              </CardDescription>
            </div>
            <div className='flex gap-2'>
              {template.status === 'active' && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={handleGenerate}
                  disabled={generateInvoice.isPending}
                >
                  <IconPlayerPlay className='mr-2 h-4 w-4' />
                  Generate Invoice Now
                </Button>
              )}
              {template._count &&
                template._count.invoices > invoices.length && (
                  <Button variant='outline' size='sm' asChild>
                    <Link
                      href={`/dashboard/invoices?recurringTemplateId=${template.id}`}
                    >
                      View All
                    </Link>
                  </Button>
                )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className='text-muted-foreground py-4 text-sm'>
              No invoices have been generated from this template yet.
            </p>
          ) : (
            <Table className='text-sm'>
              <TableHeader>
                <TableRow>
                  <TableHead className='text-muted-foreground font-medium'>
                    Invoice #
                  </TableHead>
                  <TableHead className='text-muted-foreground font-medium'>
                    Status
                  </TableHead>
                  <TableHead className='text-muted-foreground font-medium'>
                    Issue Date
                  </TableHead>
                  <TableHead className='text-muted-foreground font-medium'>
                    Due Date
                  </TableHead>
                  <TableHead className='text-muted-foreground text-right font-medium'>
                    Amount
                  </TableHead>
                  <TableHead className='text-muted-foreground text-right font-medium'>
                    Paid
                  </TableHead>
                  <TableHead className='text-muted-foreground text-right font-medium'>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice: any) => {
                  const invSubtotal =
                    invoice.items?.reduce(
                      (sum: number, item: any) =>
                        sum + item.price * item.quantity,
                      0
                    ) || 0;
                  const invTax =
                    invoice.items?.reduce(
                      (sum: number, item: any) =>
                        sum + item.price * item.quantity * (item.taxRate / 100),
                      0
                    ) || 0;
                  const invTotal = invSubtotal + invTax;
                  const invPaid =
                    invoice.payments?.reduce(
                      (sum: number, p: any) => sum + p.amount,
                      0
                    ) || 0;
                  const invStatusConfig = statusColors[invoice.status] || {
                    variant: 'outline',
                    className: ''
                  };

                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className='font-medium'>
                        #{invoice.invoiceNo}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={invStatusConfig.variant}
                          className={invStatusConfig.className}
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.issueDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.dueDate), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className='text-right font-medium'>
                        {formatCurrency(invTotal)}
                      </TableCell>
                      <TableCell className='text-right'>
                        {invPaid > 0 ? (
                          <span className='font-medium text-green-600'>
                            {formatCurrency(invPaid)}
                          </span>
                        ) : (
                          <span className='text-muted-foreground'>-</span>
                        )}
                      </TableCell>
                      <TableCell className='text-right'>
                        <Button variant='ghost' size='sm' asChild>
                          <Link href={`/dashboard/invoices/${invoice.id}`}>
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
