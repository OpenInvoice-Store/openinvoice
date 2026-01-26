'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/features/invoicing/hooks/use-invoices';
import { formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconBell } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

export default function InvoiceRemindersPage() {
  const params = useParams();
  const id = params?.id as string;
  const invoiceQuery = useInvoice(id);
  const { data: invoice, isLoading } = invoiceQuery;

  // Fetch email logs
  const { data: emailLogs = [] } = useQuery({
    queryKey: ['emailLogs', id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}/email-logs`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!invoice) {
    return <div className='p-4'>Invoice not found</div>;
  }

  const reminderLogs = emailLogs.filter(
    (log: any) => log.emailType === 'payment_reminder'
  );

  return (
    <div className='space-y-6 p-6'>
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
          {reminderLogs.length === 0 ? (
            <div className='text-muted-foreground py-8 text-center text-sm'>
              <IconBell className='mx-auto mb-2 h-8 w-8 opacity-50' />
              <p>No payment reminders have been sent yet.</p>
              {invoice.status !== 'paid' && invoice.customer?.email && (
                <p className='mt-2'>
                  Click "Send Reminder" to send the first reminder.
                </p>
              )}
            </div>
          ) : (
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
                  <div key={log.id} className='space-y-2 rounded-md border p-4'>
                    <div className='flex items-center justify-between'>
                      <div className='flex items-center gap-2'>
                        <IconBell className='h-4 w-4 text-orange-600' />
                        <span className='text-sm font-medium'>
                          {reminderType}
                        </span>
                        <Badge
                          variant={
                            log.status === 'sent' ? 'default' : 'destructive'
                          }
                          className='ml-2 text-xs'
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

                    <div className='space-y-1 text-sm'>
                      <p className='text-muted-foreground'>
                        To:{' '}
                        <span className='text-foreground'>{log.recipient}</span>
                      </p>
                      {log.errorMessage && (
                        <p className='text-sm text-red-600'>
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
                              <div key={event.id} className='py-1 text-xs'>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
