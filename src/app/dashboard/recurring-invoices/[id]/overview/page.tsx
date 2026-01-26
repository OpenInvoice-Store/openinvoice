'use client';

import { useParams } from 'next/navigation';
import { useRecurringInvoice } from '@/features/invoicing/hooks/use-recurring-invoices';
import { formatCurrency } from '@/lib/format';
import { format } from 'date-fns';
import { getInvoiceCurrency } from '@/lib/currency';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { IconPlayerPlay, IconPlayerPause, IconX } from '@tabler/icons-react';
import { toast } from 'sonner';
import {
  useUpdateRecurringInvoice,
  useGenerateRecurringInvoice
} from '@/features/invoicing/hooks/use-recurring-invoices';
import { useRouter } from 'next/navigation';

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

export default function RecurringInvoiceOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const templateQuery = useRecurringInvoice(id);
  const { data: template, isLoading } = templateQuery;
  const updateTemplate = useUpdateRecurringInvoice();
  const generateInvoice = useGenerateRecurringInvoice();

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

  // Get currency from template or organization default
  const currency = getInvoiceCurrency(
    {
      currency: (template as any).currency,
      organization: template.organization
    },
    template.organization?.defaultCurrency
  );

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

  const statusConfig = statusColors[template.status] || {
    variant: 'outline',
    className: ''
  };

  return (
    <div className='space-y-6 p-6'>
      {/* Statistics Summary */}
      {invoices.length > 0 && (
        <div className='grid gap-4 md:grid-cols-4'>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total Revenue</CardDescription>
              <CardTitle className='text-2xl'>
                {formatCurrency(totalRevenue, currency)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className='pb-2'>
              <CardDescription>Total Paid</CardDescription>
              <CardTitle className='text-2xl text-green-600'>
                {formatCurrency(totalPaid, currency)}
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

      {/* Action Buttons */}
      <div className='flex flex-wrap gap-2'>
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
      </div>

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
                Currency
              </div>
              <div className='text-sm font-semibold'>{currency}</div>
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
                  formatCurrency(total, currency)
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
    </div>
  );
}
