'use client';

import { useState, useMemo } from 'react';
import { formatDate, formatCurrency } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IconDownload,
  IconCurrencyDollar,
  IconCalendar
} from '@tabler/icons-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StripePaymentForm } from './stripe-payment-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-gray-400'
};

interface InvoicePublicViewProps {
  invoice: any;
}

export function InvoicePublicView({ invoice }: InvoicePublicViewProps) {
  const [showStripePayment, setShowStripePayment] = useState(false);

  const subtotal = invoice.items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );
  const tax = invoice.items.reduce(
    (sum: number, item: any) =>
      sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  const total = subtotal + tax;
  const totalPaid = invoice.payments.reduce(
    (sum: number, p: any) => sum + p.amount,
    0
  );
  const balance = total - totalPaid;

  // Calculate payment plan information
  const paymentPlanInfo = useMemo(() => {
    if (!invoice.paymentPlan || invoice.paymentPlan.status !== 'active') {
      return null;
    }

    const now = new Date();
    const installments = invoice.paymentPlan.installments || [];

    // Find the current installment that's due (pending or overdue)
    const currentInstallment = installments.find((inst: any) => {
      const totalPaid = (inst.payments || []).reduce(
        (sum: number, p: any) => sum + p.amount,
        0
      );
      const isFullyPaid = totalPaid >= inst.amount;
      return (
        !isFullyPaid && (inst.status === 'pending' || inst.status === 'overdue')
      );
    });

    if (!currentInstallment) {
      return null;
    }

    const installmentPaid = (currentInstallment.payments || []).reduce(
      (sum: number, p: any) => sum + p.amount,
      0
    );
    const installmentRemaining = currentInstallment.amount - installmentPaid;

    return {
      installment: currentInstallment,
      amountDue: installmentRemaining,
      installmentNumber: currentInstallment.installmentNumber,
      dueDate: currentInstallment.dueDate,
      isOverdue:
        currentInstallment.status === 'overdue' ||
        new Date(currentInstallment.dueDate) < now
    };
  }, [invoice.paymentPlan]);

  // Check Stripe Connect status for the organization
  const { data: stripeStatus } = useQuery({
    queryKey: ['stripe-connect-status', invoice.organizationId],
    queryFn: async () => {
      // For public view, we need to check if Stripe is connected
      // We'll make a request that doesn't require auth but checks the invoice's org
      try {
        const response = await fetch(
          `/api/invoices/${invoice.id}/stripe-status`
        );
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
    enabled: balance > 0
  });

  const handleDownloadPDF = () => {
    window.open(`/api/invoices/${invoice.id}/pdf`, '_blank');
  };

  return (
    <div className='bg-background min-h-screen p-6'>
      <div className='mx-auto max-w-4xl space-y-6'>
        <div className='flex items-center justify-between'>
          <div>
            <h1 className='text-3xl font-bold'>Invoice #{invoice.invoiceNo}</h1>
            <Badge
              className={`mt-2 ${statusColors[invoice.status] || 'bg-gray-500'}`}
            >
              {invoice.status}
            </Badge>
          </div>
          <div className='flex gap-2'>
            {balance > 0 &&
              stripeStatus?.connected &&
              stripeStatus?.status === 'active' && (
                <Button
                  onClick={() => setShowStripePayment(true)}
                  className='bg-green-600 hover:bg-green-700'
                >
                  <IconCurrencyDollar className='mr-2 h-4 w-4' />
                  {paymentPlanInfo
                    ? `Pay Installment #${paymentPlanInfo.installmentNumber} (${formatCurrency(paymentPlanInfo.amountDue)})`
                    : `Pay Now (${formatCurrency(balance)})`}
                </Button>
              )}
            <Button variant='outline' onClick={handleDownloadPDF}>
              <IconDownload className='mr-2 h-4 w-4' /> Download PDF
            </Button>
          </div>
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='font-semibold'>{invoice.customer?.name}</p>
              {invoice.customer?.email && (
                <p className='text-muted-foreground text-sm'>
                  {invoice.customer.email}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className='space-y-1'>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Issue Date:</span>
                <span>{formatDate(invoice.issueDate)}</span>
              </div>
              <div className='flex justify-between'>
                <span className='text-muted-foreground'>Due Date:</span>
                <span>{formatDate(invoice.dueDate)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='rounded-md border'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b'>
                    <th className='p-2 text-left'>Description</th>
                    <th className='p-2 text-right'>Quantity</th>
                    <th className='p-2 text-right'>Price</th>
                    <th className='p-2 text-right'>Tax</th>
                    <th className='p-2 text-right'>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item: any) => {
                    const itemSubtotal = item.price * item.quantity;
                    const itemTax = itemSubtotal * (item.taxRate / 100);
                    const itemTotal = itemSubtotal + itemTax;
                    return (
                      <tr key={item.id} className='border-b'>
                        <td className='p-2'>{item.description}</td>
                        <td className='p-2 text-right'>{item.quantity}</td>
                        <td className='p-2 text-right'>
                          {formatCurrency(item.price)}
                        </td>
                        <td className='p-2 text-right'>{item.taxRate}%</td>
                        <td className='p-2 text-right'>
                          {formatCurrency(itemTotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className='mt-4 ml-auto w-64 space-y-2'>
              <div className='flex justify-between'>
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className='flex justify-between'>
                <span>Tax:</span>
                <span>{formatCurrency(tax)}</span>
              </div>
              <div className='flex justify-between border-t pt-2 text-lg font-bold'>
                <span>Total:</span>
                <span>{formatCurrency(total)}</span>
              </div>
              {totalPaid > 0 && (
                <>
                  <div className='flex justify-between text-green-600'>
                    <span>Paid:</span>
                    <span>{formatCurrency(totalPaid)}</span>
                  </div>
                  <div className='flex justify-between border-t pt-2 font-bold'>
                    <span>Balance:</span>
                    <span>{formatCurrency(balance)}</span>
                  </div>
                </>
              )}
              {paymentPlanInfo && (
                <div className='mt-2 border-t pt-2'>
                  <div className='text-muted-foreground mb-1 text-xs'>
                    Payment Plan - Installment #
                    {paymentPlanInfo.installmentNumber}
                  </div>
                  <div className='flex justify-between font-semibold'>
                    <span>Amount Due:</span>
                    <span
                      className={
                        paymentPlanInfo.isOverdue ? 'text-red-600' : ''
                      }
                    >
                      {formatCurrency(paymentPlanInfo.amountDue)}
                    </span>
                  </div>
                  <div className='text-muted-foreground mt-1 text-xs'>
                    Due: {formatDate(paymentPlanInfo.dueDate)}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {invoice.paymentPlan && invoice.paymentPlan.status === 'active' && (
          <Card>
            <CardHeader>
              <CardTitle>Payment Plan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className='space-y-4'>
                <div className='grid grid-cols-2 gap-4 text-sm'>
                  <div>
                    <span className='text-muted-foreground'>Frequency:</span>
                    <p className='font-medium'>
                      {invoice.paymentPlan.frequency === 'weekly'
                        ? 'Weekly'
                        : invoice.paymentPlan.frequency === 'biweekly'
                          ? 'Bi-weekly'
                          : invoice.paymentPlan.frequency === 'monthly'
                            ? 'Monthly'
                            : 'Quarterly'}
                    </p>
                  </div>
                  <div>
                    <span className='text-muted-foreground'>Installments:</span>
                    <p className='font-medium'>
                      {invoice.paymentPlan.installmentCount}
                    </p>
                  </div>
                </div>
                {paymentPlanInfo && (
                  <div className='border-t pt-4'>
                    <div className='bg-muted/40 flex items-center justify-between rounded-lg p-3'>
                      <div>
                        <div className='font-semibold'>
                          Installment #{paymentPlanInfo.installmentNumber}
                        </div>
                        <div className='text-muted-foreground mt-1 flex items-center gap-1 text-sm'>
                          <IconCalendar className='h-3 w-3' />
                          Due: {formatDate(paymentPlanInfo.dueDate)}
                        </div>
                      </div>
                      <div className='text-right'>
                        <div className='text-lg font-semibold'>
                          {formatCurrency(paymentPlanInfo.amountDue)}
                        </div>
                        {paymentPlanInfo.isOverdue && (
                          <Badge className='mt-1 bg-red-500'>Overdue</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {invoice.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className='text-sm'>{invoice.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Stripe Payment Dialog */}
        {balance > 0 &&
          stripeStatus?.connected &&
          stripeStatus?.status === 'active' && (
            <Dialog
              open={showStripePayment}
              onOpenChange={setShowStripePayment}
            >
              <DialogContent className='max-w-2xl'>
                <DialogHeader>
                  <DialogTitle>Pay Invoice #{invoice.invoiceNo}</DialogTitle>
                  <DialogDescription>
                    {paymentPlanInfo ? (
                      <>
                        Pay Installment #{paymentPlanInfo.installmentNumber} of{' '}
                        {formatCurrency(paymentPlanInfo.amountDue)}
                        {paymentPlanInfo.isOverdue && (
                          <span className='ml-2 text-red-600'>(Overdue)</span>
                        )}
                      </>
                    ) : (
                      <>
                        Pay the remaining balance of {formatCurrency(balance)}
                      </>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <StripePaymentForm
                  invoiceId={invoice.id}
                  amount={paymentPlanInfo?.amountDue || balance}
                  onSuccess={() => {
                    setShowStripePayment(false);
                    // Reload page to show updated balance
                    window.location.reload();
                  }}
                  onCancel={() => setShowStripePayment(false)}
                />
              </DialogContent>
            </Dialog>
          )}
      </div>
    </div>
  );
}
