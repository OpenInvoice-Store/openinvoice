'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/features/invoicing/hooks/use-invoices';
import { formatDate } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { IconCheck, IconX, IconDeviceMobile } from '@tabler/icons-react';
import { useInvoiceSmsLogs } from '@/features/invoicing/hooks/use-invoice-actions';

export default function InvoiceSMSPage() {
  const params = useParams();
  const id = params?.id as string;
  const invoiceQuery = useInvoice(id);
  const { data: invoice, isLoading } = invoiceQuery;

  // Use existing hook for SMS logs
  const { data: smsLogs = [] } = useInvoiceSmsLogs(id);

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!invoice) {
    return <div className='p-4'>Invoice not found</div>;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <Badge className='bg-blue-100 text-blue-700'>
            <IconCheck className='mr-1 h-3 w-3' />
            Sent
          </Badge>
        );
      case 'delivered':
        return (
          <Badge className='bg-green-100 text-green-700'>
            <IconCheck className='mr-1 h-3 w-3' />
            Delivered
          </Badge>
        );
      case 'failed':
        return (
          <Badge className='bg-red-100 text-red-700'>
            <IconX className='mr-1 h-3 w-3' />
            Failed
          </Badge>
        );
      case 'pending':
        return <Badge className='bg-yellow-100 text-yellow-700'>Pending</Badge>;
      default:
        return <Badge className='bg-gray-100 text-gray-700'>{status}</Badge>;
    }
  };

  const getSMSTypeLabel = (smsType: string) => {
    switch (smsType) {
      case 'invoice':
        return 'Invoice Notification';
      case 'payment_confirmation':
        return 'Payment Confirmation';
      case 'payment_reminder':
        return 'Payment Reminder';
      default:
        return smsType;
    }
  };

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <IconDeviceMobile className='h-5 w-5' />
            SMS History
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          {smsLogs.length === 0 ? (
            <p className='text-muted-foreground py-4 text-sm'>
              No SMS messages sent yet for this invoice.
            </p>
          ) : (
            smsLogs.map((log: any) => (
              <div key={log.id} className='border-border rounded-lg border p-4'>
                <div className='flex items-start justify-between'>
                  <div className='flex-1 space-y-2'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-semibold'>
                        {getSMSTypeLabel(log.smsType)}
                      </span>
                      {getStatusBadge(log.status)}
                    </div>
                    <div className='text-muted-foreground text-sm'>
                      <p>
                        <span className='font-medium'>To:</span> {log.recipient}
                      </p>
                      <p className='mt-1'>
                        <span className='font-medium'>Sent:</span>{' '}
                        {formatDate(log.sentAt)}
                      </p>
                      {log.deliveredAt && (
                        <p className='mt-1'>
                          <span className='font-medium'>Delivered:</span>{' '}
                          {formatDate(log.deliveredAt)}
                        </p>
                      )}
                      {log.twilioSid && (
                        <p className='mt-1'>
                          <span className='font-medium'>Twilio SID:</span>{' '}
                          <code className='text-xs'>{log.twilioSid}</code>
                        </p>
                      )}
                    </div>
                    {log.message && (
                      <div className='bg-muted rounded-md p-3 text-sm'>
                        <p className='mb-1 font-medium'>Message:</p>
                        <p className='text-muted-foreground whitespace-pre-wrap'>
                          {log.message}
                        </p>
                      </div>
                    )}
                    {log.errorMessage && (
                      <div className='rounded-md border border-red-200 bg-red-50 p-3 text-sm'>
                        <p className='mb-1 font-medium text-red-800'>Error:</p>
                        <p className='text-red-700'>{log.errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
