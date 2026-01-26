'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/features/invoicing/hooks/use-invoices';
import { formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconCheck, IconX } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';

export default function InvoiceEmailsPage() {
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

  return (
    <div className='space-y-6 p-6'>
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
                <div key={log.id} className='space-y-3 rounded-md border p-4'>
                  <div className='flex items-center justify-between'>
                    <div className='flex items-center gap-2'>
                      {log.status === 'sent' ? (
                        <IconCheck className='h-4 w-4 text-green-600' />
                      ) : (
                        <IconX className='h-4 w-4 text-red-600' />
                      )}
                      <span className='text-sm font-medium capitalize'>
                        {log.emailType.replace('_', ' ')}
                      </span>
                      <Badge
                        variant={
                          log.status === 'sent' ? 'default' : 'destructive'
                        }
                        className='ml-2 text-xs'
                      >
                        {log.status}
                      </Badge>
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
                              <div key={event.id} className='py-1 text-xs'>
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
    </div>
  );
}
