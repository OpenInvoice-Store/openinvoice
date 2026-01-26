'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  useRecurringInvoice,
  useDeleteRecurringInvoice,
  useUpdateRecurringInvoice,
  useGenerateRecurringInvoice
} from '../hooks/use-recurring-invoices';
import { UsageRecordForm } from './usage-record-form';
import { UsageHistory } from './usage-history';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  IconEdit,
  IconTrash,
  IconPlayerPlay,
  IconPlayerPause,
  IconX,
  IconArrowLeft
} from '@tabler/icons-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

export function RecurringInvoiceView() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { data: template, isLoading } = useRecurringInvoice(id);
  const deleteTemplate = useDeleteRecurringInvoice();
  const updateTemplate = useUpdateRecurringInvoice();
  const generateInvoice = useGenerateRecurringInvoice();

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!template) {
    return <div className='p-4'>Template not found</div>;
  }

  const items = JSON.parse(template.templateItems);
  const subtotal = items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );
  const tax = items.reduce(
    (sum: number, item: any) =>
      sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  const total = subtotal + tax;

  // Calculate statistics from generated invoices
  const invoices = template.invoices || [];
  const totalRevenue = invoices.reduce((sum: number, inv: any) => {
    const invSubtotal =
      inv.items?.reduce(
        (s: number, item: any) => s + item.price * item.quantity,
        0
      ) || 0;
    const invTax =
      inv.items?.reduce(
        (s: number, item: any) =>
          s + item.price * item.quantity * (item.taxRate / 100),
        0
      ) || 0;
    return sum + invSubtotal + invTax;
  }, 0);
  const totalPaid = invoices.reduce((sum: number, inv: any) => {
    return (
      sum + (inv.payments?.reduce((s: number, p: any) => s + p.amount, 0) || 0)
    );
  }, 0);
  const paidInvoices = invoices.filter(
    (inv: any) => inv.status === 'paid'
  ).length;
  const pendingInvoices = invoices.filter(
    (inv: any) => inv.status === 'sent' || inv.status === 'draft'
  ).length;
  const overdueInvoices = invoices.filter(
    (inv: any) => inv.status === 'overdue'
  ).length;

  const frequencyLabels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Bi-weekly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
    custom: `Every ${template.interval} days`
  };

  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete "${template.name}"? This will not delete invoices already generated.`
      )
    ) {
      return;
    }

    try {
      await deleteTemplate.mutateAsync(template.id);
      toast.success('Recurring invoice template deleted');
      router.push('/dashboard/recurring-invoices');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete template'
      );
    }
  };

  const handleStatusChange = async (
    newStatus: 'active' | 'paused' | 'cancelled'
  ) => {
    try {
      await updateTemplate.mutateAsync({
        id: template.id,
        status: newStatus
      });
      toast.success(
        `Template ${newStatus === 'active' ? 'activated' : newStatus === 'paused' ? 'paused' : 'cancelled'}`
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update template'
      );
    }
  };

  const handleGenerate = async () => {
    try {
      const result = await generateInvoice.mutateAsync(template.id);
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

  const statusColors: Record<
    string,
    {
      variant: 'default' | 'secondary' | 'destructive' | 'outline';
      className: string;
    }
  > = {
    active: { variant: 'default', className: 'bg-green-600' },
    paused: { variant: 'secondary', className: 'bg-yellow-600' },
    cancelled: { variant: 'destructive', className: 'bg-red-600' },
    completed: { variant: 'outline', className: '' }
  };
  const statusConfig = statusColors[template.status] || {
    variant: 'outline',
    className: ''
  };

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <Button variant='ghost' onClick={() => router.back()}>
          <IconArrowLeft className='mr-2 h-4 w-4' />
          Back
        </Button>
        <div className='flex gap-2'>
          {template.status === 'active' && (
            <Button
              variant='outline'
              onClick={handleGenerate}
              disabled={generateInvoice.isPending}
            >
              <IconPlayerPlay className='mr-2 h-4 w-4' />
              Generate Invoice Now
            </Button>
          )}
          <Button variant='outline' asChild>
            <Link href={`/dashboard/recurring-invoices/${template.id}/edit`}>
              <IconEdit className='mr-2 h-4 w-4' />
              Edit
            </Link>
          </Button>
          {template.status === 'active' ? (
            <Button
              variant='outline'
              onClick={() => handleStatusChange('paused')}
            >
              <IconPlayerPause className='mr-2 h-4 w-4' />
              Pause
            </Button>
          ) : template.status === 'paused' ? (
            <Button
              variant='outline'
              onClick={() => handleStatusChange('active')}
            >
              <IconPlayerPlay className='mr-2 h-4 w-4' />
              Resume
            </Button>
          ) : null}
          {template.status !== 'cancelled' && (
            <Button
              variant='outline'
              onClick={() => handleStatusChange('cancelled')}
            >
              <IconX className='mr-2 h-4 w-4' />
              Cancel
            </Button>
          )}
          <Button
            variant='destructive'
            onClick={handleDelete}
            disabled={deleteTemplate.isPending}
          >
            <IconTrash className='mr-2 h-4 w-4' />
            Delete
          </Button>
        </div>
      </div>

      {/* Statistics Summary */}
      {invoices.length > 0 && (
        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className='text-2xl'>
                {formatCurrency(totalRevenue)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total Paid</CardDescription>
              <CardTitle className='text-2xl text-green-600'>
                {formatCurrency(totalPaid)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Paid Invoices</CardDescription>
              <CardTitle className='text-2xl'>
                {paidInvoices} / {invoices.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Pending/Overdue</CardDescription>
              <CardTitle className='text-2xl'>
                {pendingInvoices} /{' '}
                <span className='text-red-600'>{overdueInvoices}</span>
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <div className='grid gap-6 md:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Template Details</CardTitle>
            <CardDescription>
              Basic information about this recurring invoice template
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Template Name
              </div>
              <div className='text-sm font-semibold'>{template.name}</div>
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Customer
              </div>
              <div className='text-sm'>
                {template.customer?.name || 'Unknown'}
              </div>
              {template.customer?.email && (
                <div className='text-muted-foreground text-sm'>
                  {template.customer.email}
                </div>
              )}
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Status
              </div>
              <Badge
                variant={statusConfig.variant}
                className={statusConfig.className}
              >
                {template.status}
              </Badge>
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Frequency
              </div>
              <div className='text-sm'>
                {frequencyLabels[template.frequency] || template.frequency}
              </div>
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Next Generation
              </div>
              <div className='text-sm'>
                {format(new Date(template.nextGenerationDate), 'MMM d, yyyy')}
              </div>
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Total Generated
              </div>
              <div className='text-sm'>
                {template.totalGenerated} invoice
                {template.totalGenerated !== 1 ? 's' : ''}
              </div>
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Template Amount
              </div>
              <div className='text-sm font-semibold'>
                {template.isUsageBased ? (
                  <span className='text-muted-foreground italic'>
                    Variable (usage-based)
                  </span>
                ) : (
                  formatCurrency(total)
                )}
              </div>
            </div>
            {template.isUsageBased && (
              <>
                <Separator />
                <div>
                  <div className='text-muted-foreground text-sm font-medium'>
                    Billing Type
                  </div>
                  <div className='text-sm'>
                    <Badge variant='secondary' className='text-xs'>
                      Usage-Based
                    </Badge>
                  </div>
                </div>
                <Separator />
                <div>
                  <div className='text-muted-foreground text-sm font-medium'>
                    Usage Unit
                  </div>
                  <div className='text-sm'>{template.usageUnit || 'units'}</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Recurrence schedule and settings</CardDescription>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Start Date
              </div>
              <div className='text-sm'>
                {format(new Date(template.startDate), 'MMM d, yyyy')}
              </div>
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                End Date
              </div>
              <div className='text-sm'>
                {template.endDate
                  ? format(new Date(template.endDate), 'MMM d, yyyy')
                  : 'Never'}
              </div>
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Days Until Due
              </div>
              <div className='text-sm'>{template.daysUntilDue} days</div>
            </div>
            <Separator />
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Auto Send Email
              </div>
              <div className='text-sm'>
                <Badge
                  variant={template.autoSendEmail ? 'default' : 'outline'}
                  className='text-xs'
                >
                  {template.autoSendEmail ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
            {template.interval > 1 && (
              <>
                <Separator />
                <div>
                  <div className='text-muted-foreground text-sm font-medium'>
                    Interval
                  </div>
                  <div className='text-sm'>
                    {template.interval}{' '}
                    {template.frequency === 'custom' ? 'days' : 'period(s)'}
                  </div>
                </div>
              </>
            )}
            <Separator />
            {template.lastGeneratedAt && (
              <>
                <div>
                  <div className='text-muted-foreground text-sm font-medium'>
                    Last Generated
                  </div>
                  <div className='text-sm'>
                    {format(new Date(template.lastGeneratedAt), 'MMM d, yyyy')}
                  </div>
                </div>
                <Separator />
              </>
            )}
            <div>
              <div className='text-muted-foreground text-sm font-medium'>
                Created
              </div>
              <div className='text-sm'>
                {format(new Date(template.createdAt), 'MMM d, yyyy')}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoice Items</CardTitle>
          <CardDescription>
            Items that will be included in each generated invoice
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table className='text-sm'>
            <TableHeader>
              <TableRow>
                <TableHead className='text-muted-foreground font-medium'>
                  Description
                </TableHead>
                <TableHead className='text-muted-foreground font-medium'>
                  Quantity
                </TableHead>
                <TableHead className='text-muted-foreground text-right font-medium'>
                  Price
                </TableHead>
                <TableHead className='text-muted-foreground text-right font-medium'>
                  Tax Rate
                </TableHead>
                <TableHead className='text-muted-foreground text-right font-medium'>
                  Total
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item: any, index: number) => {
                const itemTotal =
                  item.price * item.quantity * (1 + item.taxRate / 100);
                return (
                  <TableRow key={index}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell className='text-right'>
                      {formatCurrency(item.price)}
                    </TableCell>
                    <TableCell className='text-right'>
                      {item.taxRate}%
                    </TableCell>
                    <TableCell className='text-right'>
                      {formatCurrency(itemTotal)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className='mt-4 flex justify-end space-x-4 border-t pt-4 text-sm'>
            <div className='text-right'>
              <div className='text-muted-foreground'>
                Subtotal: {formatCurrency(subtotal)}
              </div>
              <div className='text-muted-foreground'>
                Tax: {formatCurrency(tax)}
              </div>
              <div className='font-semibold'>
                Total: {formatCurrency(total)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {template.isUsageBased && (
        <>
          <Card>
            <CardHeader>
              <div className='flex items-center justify-between'>
                <div>
                  <CardTitle>Usage Management</CardTitle>
                  <CardDescription>
                    Record and view usage data for this billing template
                  </CardDescription>
                </div>
                <UsageRecordForm
                  templateId={template.id}
                  usageUnit={template.usageUnit}
                />
              </div>
            </CardHeader>
          </Card>
          <UsageHistory
            templateId={template.id}
            usageUnit={template.usageUnit}
          />
        </>
      )}

      {template.templateNotes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className='text-sm whitespace-pre-wrap'>
              {template.templateNotes}
            </p>
          </CardContent>
        </Card>
      )}

      {template.invoices && template.invoices.length > 0 && (
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle>Generated Invoices</CardTitle>
                <CardDescription>
                  {template.invoices.length} invoice
                  {template.invoices.length !== 1 ? 's' : ''} created from this
                  template
                  {template._count &&
                    template._count.invoices > template.invoices.length && (
                      <span className='text-muted-foreground ml-2'>
                        (showing latest {template.invoices.length} of{' '}
                        {template._count.invoices})
                      </span>
                    )}
                </CardDescription>
              </div>
              {template._count &&
                template._count.invoices > template.invoices.length && (
                  <Button variant='outline' size='sm' asChild>
                    <Link
                      href={`/dashboard/invoices?recurringTemplateId=${template.id}`}
                    >
                      View All
                    </Link>
                  </Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
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
                {template.invoices.map((invoice: any) => {
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
                  const statusColors: Record<
                    string,
                    {
                      variant:
                        | 'default'
                        | 'secondary'
                        | 'destructive'
                        | 'outline';
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
