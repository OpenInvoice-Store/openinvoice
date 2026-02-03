'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '../hooks/use-invoices';
import { formatDate } from '@/lib/format';
import { formatCurrencyAmount, getInvoiceCurrency } from '@/lib/currency';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  IconEdit,
  IconDownload,
  IconLink,
  IconMail,
  IconCheck,
  IconX,
  IconCurrencyDollar,
  IconNotes,
  IconBell,
  IconDeviceMobile
} from '@tabler/icons-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentsList } from './payments-list';
import { PaymentForm } from './payment-form';
import { StripePaymentForm } from './stripe-payment-form';
import { CryptoPaymentForm } from './crypto-payment-form';
import { PaymentPlanSection } from './payment-plan-section';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  useInvoiceEmailLogs,
  useGenerateShareLink,
  useSendInvoiceEmail,
  useSendInvoiceReminder,
  useSendInvoiceSMS
} from '../hooks/use-invoice-actions';
import { useStripeConnectStatus } from '../hooks/use-stripe';
import { useQueryClient } from '@tanstack/react-query';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  sent: 'bg-blue-500',
  paid: 'bg-green-500',
  overdue: 'bg-red-500',
  cancelled: 'bg-gray-400'
};

type InvoiceSection = 'details' | 'payments' | 'emails' | 'reminders' | 'notes';

export function InvoiceView() {
  const params = useParams();
  const id = params?.id as string;
  const invoiceQuery = useInvoice(id);
  const { data: invoice, isLoading } = invoiceQuery;
  const [activeSection, setActiveSection] = useState<InvoiceSection>('details');
  const queryClient = useQueryClient();

  const { data: stripeStatus } = useStripeConnectStatus();
  const { data: emailLogs = [], refetch: refetchEmailLogs } =
    useInvoiceEmailLogs(id);
  const generateShareLink = useGenerateShareLink();
  const sendEmail = useSendInvoiceEmail();
  const sendReminder = useSendInvoiceReminder();
  const sendSMS = useSendInvoiceSMS();

  // Handle direct payment redirect to Stripe Checkout
  const handlePayNow = useCallback(async () => {
    if (!invoice) return;

    const invoiceTotals = calculateInvoiceTotals(invoice as any);
    const balance = invoiceTotals.balance;

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceId: id,
          amount: balance
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create checkout session');
      }

      const data = await response.json();

      if (data.url) {
        // Open Stripe Checkout in a new tab
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create payment link');
    }
  }, [id, invoice]);

  // Function to refresh payment data after successful payment
  // Since Stripe processes payments via webhook, we poll a few times to wait for it
  const refreshPaymentData = useCallback(async () => {
    // Immediately invalidate and refetch
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['payments', id] }),
      queryClient.invalidateQueries({ queryKey: ['invoice', id] }),
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      invoiceQuery.refetch(),
      refetchEmailLogs()
    ]);

    // Poll for payment to appear (webhook might take a moment)
    let attempts = 0;
    const maxAttempts = 5;
    const pollInterval = 1000; // 1 second

    const pollForPayment = async () => {
      if (attempts >= maxAttempts) {
        return;
      }

      attempts++;
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      // Refetch payments
      await queryClient.invalidateQueries({ queryKey: ['payments', id] });
      await queryClient.invalidateQueries({ queryKey: ['invoice', id] });

      // Continue polling
      if (attempts < maxAttempts) {
        await pollForPayment();
      }
    };

    // Start polling
    pollForPayment();
  }, [id, queryClient, invoiceQuery, refetchEmailLogs]);

  const handleDownloadPDF = () => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  const handleShareLink = async () => {
    try {
      await generateShareLink.mutateAsync(id);
    } catch (error) {
      // Error is handled by the hook
      console.error('Error generating share link:', error);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice?.customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }

    try {
      await sendEmail.mutateAsync(id);
      invoiceQuery.refetch();
      refetchEmailLogs();
    } catch (error) {
      // Error is handled by the hook
      console.error('Error sending email:', error);
    }
  };

  const handleSendReminder = async () => {
    if (!invoice?.customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }

    if (invoice.status === 'paid') {
      toast.error('Cannot send reminder for a paid invoice');
      return;
    }

    try {
      await sendReminder.mutateAsync(id);
      invoiceQuery.refetch();
      refetchEmailLogs();
    } catch (error) {
      // Error is handled by the hook
      console.error('Error sending reminder:', error);
    }
  };

  const handleSendSMS = async () => {
    if (!invoice?.customer?.phone) {
      toast.error('Customer does not have a phone number');
      return;
    }

    try {
      await sendSMS.mutateAsync(id);
      invoiceQuery.refetch();
    } catch (error) {
      // Error is handled by the hook
      console.error('Error sending SMS:', error);
    }
  };

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!invoice) {
    return <div className='p-4'>Invoice not found</div>;
  }

  // Calculate invoice totals using utility function
  const {
    subtotal,
    manualTax,
    customTax,
    totalTax,
    total,
    totalPaid,
    balance
  } = calculateInvoiceTotals(invoice);

  // Get invoice taxes for display
  const invoiceTaxesRaw = (invoice as any)?.invoiceTaxes;
  let invoiceTaxes: any[] = [];

  if (Array.isArray(invoiceTaxesRaw)) {
    invoiceTaxes = invoiceTaxesRaw;
  } else if (invoiceTaxesRaw && typeof invoiceTaxesRaw === 'object') {
    invoiceTaxes = [invoiceTaxesRaw];
  }
  const taxCalculationMethod = (invoice as any)?.taxCalculationMethod;

  // Get currency from invoice or organization default
  const currency = getInvoiceCurrency(
    invoice as any,
    (invoice as any).organization?.defaultCurrency
  );

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
        <div>
          <h2 className='text-2xl font-bold'>Invoice #{invoice.invoiceNo}</h2>
          <Badge
            className={`mt-2 ${statusColors[invoice.status] || 'bg-gray-500'}`}
          >
            {invoice.status}
          </Badge>
        </div>
        <div className='flex flex-wrap gap-2'>
          {balance > 0 &&
            stripeStatus?.connected &&
            stripeStatus?.status === 'active' && (
              <Button
                variant='default'
                onClick={handlePayNow}
                className='bg-green-600 hover:bg-green-700'
              >
                <IconCurrencyDollar className='mr-2 h-4 w-4' />
                Pay Now
              </Button>
            )}
          {invoice.customer?.email && (
            <>
              <Button
                variant='default'
                onClick={handleSendEmail}
                disabled={sendEmail.isPending}
              >
                <IconMail className='mr-2 h-4 w-4' />
                {sendEmail.isPending ? 'Sending...' : 'Send Email'}
              </Button>
              {invoice.status !== 'paid' && (
                <Button
                  variant='outline'
                  onClick={handleSendReminder}
                  disabled={sendReminder.isPending}
                >
                  <IconBell className='mr-2 h-4 w-4' />
                  {sendReminder.isPending ? 'Sending...' : 'Send Reminder'}
                </Button>
              )}
            </>
          )}
          {invoice.customer?.phone && (
            <Button
              variant='default'
              onClick={handleSendSMS}
              disabled={sendSMS.isPending}
            >
              <IconDeviceMobile className='mr-2 h-4 w-4' />
              {sendSMS.isPending ? 'Sending...' : 'Send SMS'}
            </Button>
          )}
          <Button
            variant='outline'
            onClick={handleShareLink}
            disabled={generateShareLink.isPending}
          >
            <IconLink className='mr-2 h-4 w-4' />
            {generateShareLink.isPending ? 'Generating...' : 'Share Link'}
          </Button>
          <Button variant='outline' onClick={handleDownloadPDF}>
            <IconDownload className='mr-2 h-4 w-4' /> Download PDF
          </Button>
          <Button variant='outline' asChild>
            <Link href={`/dashboard/invoices/${id}/edit`}>
              <IconEdit className='mr-2 h-4 w-4' /> Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Main layout: left section nav + right content */}
      <div className='mt-2 grid gap-6 md:grid-cols-12'>
        {/* Section navigation */}
        <div className='flex h-full flex-col p-3 md:col-span-3'>
          <div className='text-muted-foreground mb-2 px-1 text-xs font-semibold tracking-wide uppercase'>
            Sections
          </div>
          <div className='flex flex-col gap-1'>
            <Button
              variant={activeSection === 'details' ? 'default' : 'ghost'}
              size='sm'
              className='justify-start gap-2'
              onClick={() => setActiveSection('details')}
            >
              <IconNotes className='h-4 w-4' />
              Details
            </Button>
            <Button
              variant={activeSection === 'payments' ? 'default' : 'ghost'}
              size='sm'
              className='justify-start gap-2'
              onClick={() => setActiveSection('payments')}
            >
              <IconCurrencyDollar className='h-4 w-4' />
              Payments
              {invoice.payments.length > 0 && (
                <span className='ml-auto rounded-full bg-emerald-100 px-2 text-xs font-medium text-emerald-700'>
                  {invoice.payments.length}
                </span>
              )}
            </Button>
            <Button
              variant={activeSection === 'emails' ? 'default' : 'ghost'}
              size='sm'
              className='justify-start gap-2'
              onClick={() => setActiveSection('emails')}
            >
              <IconMail className='h-4 w-4' />
              Emails
              {emailLogs.length > 0 && (
                <span className='ml-auto rounded-full bg-blue-100 px-2 text-xs font-medium text-blue-700'>
                  {emailLogs.length}
                </span>
              )}
            </Button>
            <Button
              variant={activeSection === 'reminders' ? 'default' : 'ghost'}
              size='sm'
              className='justify-start gap-2'
              onClick={() => setActiveSection('reminders')}
            >
              <IconBell className='h-4 w-4' />
              Reminders
              {(invoice.reminderCount ?? 0) > 0 && (
                <span className='ml-auto rounded-full bg-orange-100 px-2 text-xs font-medium text-orange-700'>
                  {invoice.reminderCount ?? 0}
                </span>
              )}
            </Button>
            <Button
              variant={activeSection === 'notes' ? 'default' : 'ghost'}
              size='sm'
              className='justify-start gap-2'
              onClick={() => setActiveSection('notes')}
            >
              <IconNotes className='h-4 w-4' />
              Notes
            </Button>
          </div>
        </div>

        {/* Section content */}
        <div className='space-y-6 md:col-span-9'>
          {activeSection === 'details' && (
            <>
              <div className='grid gap-4 md:grid-cols-2'>
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
                    {invoice.emailSentCount !== undefined &&
                      invoice.emailSentCount > 0 && (
                        <div className='mt-2 flex justify-between border-t pt-2'>
                          <span className='text-muted-foreground'>
                            Emails Sent:
                          </span>
                          <span className='font-semibold'>
                            {invoice.emailSentCount}
                          </span>
                        </div>
                      )}
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
                        {invoice.items.map((item) => {
                          const itemSubtotal = item.price * item.quantity;
                          const itemTax = itemSubtotal * (item.taxRate / 100);
                          const itemTotal = itemSubtotal + itemTax;
                          return (
                            <tr key={item.id} className='border-b'>
                              <td className='p-2'>{item.description}</td>
                              <td className='p-2 text-right'>
                                {item.quantity}
                              </td>
                              <td className='p-2 text-right'>
                                {formatCurrencyAmount(item.price, currency)}
                              </td>
                              <td className='p-2 text-right'>
                                {item.taxRate}%
                              </td>
                              <td className='p-2 text-right'>
                                {formatCurrencyAmount(itemTotal, currency)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className='mt-4 ml-auto w-full max-w-xs space-y-2'>
                    <div className='flex justify-between'>
                      <span className='text-muted-foreground'>Subtotal:</span>
                      <span className='font-medium'>
                        {formatCurrencyAmount(subtotal, currency)}
                      </span>
                    </div>

                    {/* Tax Breakdown Section */}
                    {/* Always show tax section - display taxes if they exist */}
                    <div className='border-t pt-2'>
                      {manualTax > 0 && (
                        <div className='mb-1 flex justify-between'>
                          <span className='text-muted-foreground'>
                            Manual Tax:
                          </span>
                          <span>
                            {formatCurrencyAmount(manualTax, currency)}
                          </span>
                        </div>
                      )}
                      {invoiceTaxes && invoiceTaxes.length > 0 ? (
                        <>
                          {invoiceTaxes.map((tax: any, index: number) => {
                            if (!tax || typeof tax !== 'object') return null;
                            return (
                              <div
                                key={tax?.id || `tax-${index}`}
                                className='mb-1 flex justify-between'
                              >
                                <span className='text-muted-foreground flex items-center gap-1.5'>
                                  <span>{tax?.name || 'Tax'}</span>
                                  {tax?.rate !== undefined &&
                                    tax?.rate !== null && (
                                      <span className='text-xs'>
                                        ({tax.rate}%)
                                      </span>
                                    )}
                                  {taxCalculationMethod === 'profile' && (
                                    <Badge
                                      variant='outline'
                                      className='h-4 px-1 text-xs'
                                    >
                                      Profile
                                    </Badge>
                                  )}
                                  {taxCalculationMethod === 'override' && (
                                    <Badge
                                      variant='outline'
                                      className='h-4 px-1 text-xs'
                                    >
                                      Override
                                    </Badge>
                                  )}
                                </span>
                                <span className='font-medium'>
                                  {formatCurrencyAmount(
                                    tax?.amount || 0,
                                    currency
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {totalTax > 0 && (
                            <div className='mt-1 flex justify-between border-t pt-1'>
                              <span className='text-muted-foreground font-medium'>
                                Total Tax:
                              </span>
                              <span className='font-medium'>
                                {formatCurrencyAmount(totalTax, currency)}
                              </span>
                            </div>
                          )}
                        </>
                      ) : taxCalculationMethod &&
                        taxCalculationMethod !== 'manual' ? (
                        <div className='text-muted-foreground text-sm italic'>
                          Tax profile selected but no taxes calculated. Please
                          edit the invoice to recalculate taxes.
                        </div>
                      ) : totalTax === 0 ? (
                        <div className='flex justify-between'>
                          <span className='text-muted-foreground'>Tax:</span>
                          <span className='text-muted-foreground'>
                            {formatCurrencyAmount(0, currency)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div className='flex justify-between border-t pt-2 text-lg font-bold'>
                      <span>Total:</span>
                      <span>{formatCurrencyAmount(total, currency)}</span>
                    </div>
                    {totalPaid > 0 && (
                      <>
                        <div className='flex justify-between text-green-600'>
                          <span>Paid:</span>
                          <span>
                            {formatCurrencyAmount(totalPaid, currency)}
                          </span>
                        </div>
                        <div className='flex justify-between border-t pt-2 font-bold'>
                          <span>Balance:</span>
                          <span>{formatCurrencyAmount(balance, currency)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>

              <PaymentPlanSection
                invoiceId={id}
                invoiceTotal={total}
                totalPaid={totalPaid}
              />
            </>
          )}

          {activeSection === 'payments' && (
            <Card>
              <CardHeader>
                <CardTitle>Payments & Receipts</CardTitle>
              </CardHeader>
              <CardContent className='space-y-6'>
                {balance > 0 && (
                  <div className='bg-muted/40 mb-2 space-y-4 rounded-md border p-4'>
                    {stripeStatus?.connected &&
                    stripeStatus?.status === 'active' ? (
                      <StripePaymentForm
                        invoiceId={id}
                        amount={balance}
                        onSuccess={async () => {
                          await refreshPaymentData();
                        }}
                      />
                    ) : null}
                    {invoice?.organization?.cryptoPaymentsEnabled && (
                      <div className='space-y-2'>
                        {stripeStatus?.connected &&
                          stripeStatus?.status === 'active' && (
                            <div className='text-muted-foreground text-center text-sm'>
                              Or
                            </div>
                          )}
                        <div className='text-muted-foreground text-sm font-medium'>
                          Pay with cryptocurrency:
                        </div>
                        <CryptoPaymentForm
                          invoiceId={id}
                          amount={balance}
                          onSuccess={async () => {
                            await refreshPaymentData();
                          }}
                        />
                      </div>
                    )}
                    <div className='text-muted-foreground text-sm'>
                      Or record a manual payment:
                    </div>
                    <PaymentForm
                      invoiceId={id}
                      maxAmount={balance}
                      onSuccess={async () => {
                        await refreshPaymentData();
                      }}
                    />
                  </div>
                )}
                <PaymentsList invoiceId={id} />
              </CardContent>
            </Card>
          )}

          {activeSection === 'emails' && (
            <Card>
              <CardHeader>
                <CardTitle>Email History</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                {emailLogs.length === 0 ? (
                  <p className='text-muted-foreground py-4 text-sm'>
                    No emails sent yet for this invoice.
                  </p>
                ) : (
                  emailLogs.map((log: any) => {
                    const events = log.events || [];
                    const openedCount = events.filter(
                      (e: any) => e.eventType === 'email.opened'
                    ).length;
                    const clickedCount = events.filter(
                      (e: any) => e.eventType === 'email.clicked'
                    ).length;
                    const delivered = events.some(
                      (e: any) => e.eventType === 'email.delivered'
                    );
                    const bounced = events.some(
                      (e: any) => e.eventType === 'email.bounced'
                    );

                    return (
                      <div
                        key={log.id}
                        className='space-y-3 rounded-md border p-4'
                      >
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center gap-2'>
                            {log.status === 'sent' ? (
                              <IconCheck className='h-4 w-4 text-green-600' />
                            ) : (
                              <IconX className='h-4 w-4 text-red-600' />
                            )}
                            <span className='font-medium capitalize'>
                              {log.emailType.replace('_', ' ')}
                            </span>
                            <Badge
                              variant={
                                log.status === 'sent'
                                  ? 'default'
                                  : 'destructive'
                              }
                              className='ml-2'
                            >
                              {log.status}
                            </Badge>
                          </div>
                          <span className='text-muted-foreground text-sm'>
                            {formatDate(log.sentAt)}
                          </span>
                        </div>

                        <div className='text-muted-foreground space-y-1 text-sm'>
                          <p>To: {log.recipient}</p>
                          {log.errorMessage && (
                            <p className='text-red-600'>
                              Error: {log.errorMessage}
                            </p>
                          )}
                        </div>

                        {events.length > 0 && (
                          <div className='space-y-2 border-t pt-2 text-xs'>
                            <div className='flex flex-wrap gap-2'>
                              {delivered && (
                                <Badge
                                  variant='outline'
                                  className='border-green-200 bg-green-50 text-green-700'
                                >
                                  Delivered
                                </Badge>
                              )}
                              {bounced && (
                                <Badge
                                  variant='outline'
                                  className='border-red-200 bg-red-50 text-red-700'
                                >
                                  Bounced
                                </Badge>
                              )}
                              {openedCount > 0 && (
                                <Badge
                                  variant='outline'
                                  className='border-blue-200 bg-blue-50 text-blue-700'
                                >
                                  Opened {openedCount}x
                                </Badge>
                              )}
                              {clickedCount > 0 && (
                                <Badge
                                  variant='outline'
                                  className='border-purple-200 bg-purple-50 text-purple-700'
                                >
                                  Clicked {clickedCount}x
                                </Badge>
                              )}
                            </div>

                            <details className='mt-2'>
                              <summary className='text-muted-foreground hover:text-foreground cursor-pointer'>
                                View all events ({events.length})
                              </summary>
                              <div className='mt-2 space-y-1 border-l-2 pl-4'>
                                {events.map((event: any) => {
                                  let eventLabel = event.eventType
                                    .replace('email.', '')
                                    .replace('_', ' ');
                                  eventLabel =
                                    eventLabel.charAt(0).toUpperCase() +
                                    eventLabel.slice(1);

                                  let metadata = null;
                                  try {
                                    if (event.metadata) {
                                      metadata = JSON.parse(event.metadata);
                                    }
                                  } catch {
                                    // ignore
                                  }

                                  return (
                                    <div
                                      key={event.id}
                                      className='py-1 text-xs'
                                    >
                                      <span className='font-medium'>
                                        {eventLabel}
                                      </span>
                                      <span className='text-muted-foreground ml-2'>
                                        {formatDate(event.occurredAt)}
                                      </span>
                                      {metadata?.link && (
                                        <div className='text-muted-foreground mt-1 ml-4'>
                                          Link:{' '}
                                          <a
                                            href={metadata.link}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='text-blue-600 hover:underline'
                                          >
                                            {metadata.linkUrl || metadata.link}
                                          </a>
                                        </div>
                                      )}
                                      {metadata?.bounceReason && (
                                        <div className='mt-1 ml-4 text-red-600'>
                                          Reason: {metadata.bounceReason}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </details>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          )}

          {activeSection === 'reminders' && (
            <Card>
              <CardHeader>
                <CardTitle>Payment Reminders</CardTitle>
              </CardHeader>
              <CardContent className='space-y-4'>
                {/* Reminder Summary */}
                <div className='bg-muted/40 rounded-md border p-4'>
                  <div className='grid grid-cols-2 gap-4'>
                    <div>
                      <div className='text-muted-foreground text-sm'>
                        Total Reminders Sent
                      </div>
                      <div className='text-2xl font-bold'>
                        {invoice.reminderCount ?? 0}
                      </div>
                    </div>
                    {invoice.lastReminderSentAt && (
                      <div>
                        <div className='text-muted-foreground text-sm'>
                          Last Reminder Sent
                        </div>
                        <div className='text-lg font-medium'>
                          {formatDate(invoice.lastReminderSentAt)}
                        </div>
                      </div>
                    )}
                    {invoice.markedOverdueAt && (
                      <div>
                        <div className='text-muted-foreground text-sm'>
                          Marked Overdue
                        </div>
                        <div className='text-lg font-medium'>
                          {formatDate(invoice.markedOverdueAt)}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Reminder History */}
                {(() => {
                  const reminderLogs = emailLogs.filter(
                    (log: any) => log.emailType === 'payment_reminder'
                  );

                  if (reminderLogs.length === 0) {
                    return (
                      <div className='text-muted-foreground py-8 text-center text-sm'>
                        <IconBell className='mx-auto mb-2 h-8 w-8 opacity-50' />
                        <p>No payment reminders have been sent yet.</p>
                        {invoice.status !== 'paid' &&
                          invoice.customer?.email && (
                            <p className='mt-2'>
                              Click "Send Reminder" to send the first reminder.
                            </p>
                          )}
                      </div>
                    );
                  }

                  return (
                    <div className='space-y-3'>
                      <div className='text-muted-foreground text-sm font-medium'>
                        Reminder History ({reminderLogs.length})
                      </div>
                      {reminderLogs.map((log: any) => {
                        const events = log.events || [];
                        const delivered = events.some(
                          (e: any) => e.eventType === 'email.delivered'
                        );
                        const openedCount = events.filter(
                          (e: any) => e.eventType === 'email.opened'
                        ).length;

                        // Try to determine reminder type from email subject or metadata
                        let reminderType = 'Payment Reminder';
                        if (log.errorMessage) {
                          // Failed reminder
                          reminderType = 'Failed Reminder';
                        }

                        return (
                          <div
                            key={log.id}
                            className='space-y-2 rounded-md border p-4'
                          >
                            <div className='flex items-center justify-between'>
                              <div className='flex items-center gap-2'>
                                <IconBell className='h-4 w-4 text-orange-600' />
                                <span className='font-medium'>
                                  {reminderType}
                                </span>
                                <Badge
                                  variant={
                                    log.status === 'sent'
                                      ? 'default'
                                      : 'destructive'
                                  }
                                  className='ml-2'
                                >
                                  {log.status}
                                </Badge>
                                {delivered && (
                                  <Badge
                                    variant='outline'
                                    className='border-green-200 bg-green-50 text-green-700'
                                  >
                                    Delivered
                                  </Badge>
                                )}
                                {openedCount > 0 && (
                                  <Badge
                                    variant='outline'
                                    className='border-blue-200 bg-blue-50 text-blue-700'
                                  >
                                    Opened {openedCount}x
                                  </Badge>
                                )}
                              </div>
                              <span className='text-muted-foreground text-sm'>
                                {formatDate(log.sentAt)}
                              </span>
                            </div>

                            <div className='text-muted-foreground space-y-1 text-sm'>
                              <p>To: {log.recipient}</p>
                              {log.errorMessage && (
                                <p className='text-red-600'>
                                  Error: {log.errorMessage}
                                </p>
                              )}
                            </div>

                            {events.length > 0 && (
                              <details className='mt-2'>
                                <summary className='text-muted-foreground hover:text-foreground cursor-pointer text-xs'>
                                  View email events ({events.length})
                                </summary>
                                <div className='mt-2 space-y-1 border-l-2 pl-4'>
                                  {events.map((event: any) => {
                                    let eventLabel = event.eventType
                                      .replace('email.', '')
                                      .replace('_', ' ');
                                    eventLabel =
                                      eventLabel.charAt(0).toUpperCase() +
                                      eventLabel.slice(1);

                                    return (
                                      <div
                                        key={event.id}
                                        className='py-1 text-xs'
                                      >
                                        <span className='font-medium'>
                                          {eventLabel}
                                        </span>
                                        <span className='text-muted-foreground ml-2'>
                                          {formatDate(event.occurredAt)}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </details>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {activeSection === 'notes' && (
            <Card>
              <CardHeader>
                <CardTitle>Invoice Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {invoice.notes ? (
                  <p className='text-sm whitespace-pre-wrap'>{invoice.notes}</p>
                ) : (
                  <p className='text-muted-foreground text-sm'>
                    No notes have been added for this invoice yet.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
