'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '../hooks/use-invoices';
import { formatDate, formatCurrency } from '@/lib/format';
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
  IconBell
} from '@tabler/icons-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentsList } from './payments-list';
import { PaymentForm } from './payment-form';
import { StripePaymentForm } from './stripe-payment-form';
import { PaymentPlanSection } from './payment-plan-section';
import { useState } from 'react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

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
  const [showStripePayment, setShowStripePayment] = useState(false);
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [activeSection, setActiveSection] = useState<InvoiceSection>('details');

  // Check Stripe Connect status
  const { data: stripeStatus } = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: async () => {
      const response = await fetch('/api/stripe/connect/status');
      if (!response.ok) return null;
      return response.json();
    }
  });

  // Fetch email logs
  const { data: emailLogs = [], refetch: refetchEmailLogs } = useQuery({
    queryKey: ['emailLogs', id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}/email-logs`);
      if (!res.ok) throw new Error('Failed to fetch email logs');
      return res.json();
    },
    enabled: !!id
  });

  const handleDownloadPDF = () => {
    window.open(`/api/invoices/${id}/pdf`, '_blank');
  };

  const handleShareLink = async () => {
    try {
      setIsGeneratingLink(true);
      const response = await fetch(`/api/invoices/${id}/share`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const { shareUrl } = await response.json();
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Shareable link copied to clipboard!');
    } catch (error) {
      toast.error('Failed to generate share link');
      console.error('Error generating share link:', error);
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleSendEmail = async () => {
    if (!invoice?.customer?.email) {
      toast.error('Customer does not have an email address');
      return;
    }

    try {
      setIsSendingEmail(true);
      const response = await fetch(`/api/invoices/${id}/send-email`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      toast.success('Invoice email sent successfully!');
      // Refetch invoice and email logs to get updated data
      invoiceQuery.refetch();
      refetchEmailLogs();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send email'
      );
      console.error('Error sending email:', error);
    } finally {
      setIsSendingEmail(false);
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
      setIsSendingReminder(true);
      const response = await fetch(`/api/invoices/${id}/send-reminder`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send reminder');
      }

      const data = await response.json();
      toast.success('Payment reminder sent successfully!');
      // Refetch invoice and email logs to get updated data
      invoiceQuery.refetch();
      refetchEmailLogs();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send reminder'
      );
      console.error('Error sending reminder:', error);
    } finally {
      setIsSendingReminder(false);
    }
  };

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!invoice) {
    return <div className='p-4'>Invoice not found</div>;
  }

  const subtotal = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const tax = invoice.items.reduce(
    (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  const total = subtotal + tax;
  const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = total - totalPaid;

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
                onClick={() => setShowStripePayment(true)}
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
                disabled={isSendingEmail}
              >
                <IconMail className='mr-2 h-4 w-4' />
                {isSendingEmail ? 'Sending...' : 'Send Email'}
              </Button>
              {invoice.status !== 'paid' && (
                <Button
                  variant='outline'
                  onClick={handleSendReminder}
                  disabled={isSendingReminder}
                >
                  <IconBell className='mr-2 h-4 w-4' />
                  {isSendingReminder ? 'Sending...' : 'Send Reminder'}
                </Button>
              )}
            </>
          )}
          <Button
            variant='outline'
            onClick={handleShareLink}
            disabled={isGeneratingLink}
          >
            <IconLink className='mr-2 h-4 w-4' />
            {isGeneratingLink ? 'Generating...' : 'Share Link'}
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
                                {formatCurrency(item.price)}
                              </td>
                              <td className='p-2 text-right'>
                                {item.taxRate}%
                              </td>
                              <td className='p-2 text-right'>
                                {formatCurrency(itemTotal)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className='mt-4 ml-auto w-full max-w-xs space-y-2'>
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
                        onSuccess={() => {
                          refetchEmailLogs();
                          invoiceQuery.refetch();
                          toast.success('Payment processed successfully!');
                        }}
                        onCancel={() => undefined}
                      />
                    ) : null}
                    <div className='text-muted-foreground text-sm'>
                      Or record a manual payment:
                    </div>
                    <PaymentForm
                      invoiceId={id}
                      maxAmount={balance}
                      onSuccess={() => {
                        refetchEmailLogs();
                        invoiceQuery.refetch();
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

      {/* Stripe Payment Dialog */}
      <Dialog open={showStripePayment} onOpenChange={setShowStripePayment}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Pay Invoice #{invoice.invoiceNo}</DialogTitle>
            <DialogDescription>
              Pay the remaining balance of {formatCurrency(balance)}
            </DialogDescription>
          </DialogHeader>
          <StripePaymentForm
            invoiceId={id}
            amount={balance}
            onSuccess={() => {
              setShowStripePayment(false);
              refetchEmailLogs();
              invoiceQuery.refetch();
              toast.success('Payment processed successfully!');
            }}
            onCancel={() => setShowStripePayment(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
