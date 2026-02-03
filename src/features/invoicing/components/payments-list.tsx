'use client';

import { usePayments, useDeletePayment } from '../hooks/use-payments';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconTrash, IconDownload, IconRefresh } from '@tabler/icons-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { formatDate, formatCurrency } from '@/lib/format';
import { getInvoiceCurrency } from '@/lib/currency';
import { useInvoice } from '../hooks/use-invoices';
import { isCryptoPayment, isCryptoPaymentConfirmed } from '@/lib/payment-utils';
import { useState } from 'react';
import { TruncatedText } from '@/components/ui/truncated-text';

export function PaymentsList({ invoiceId }: { invoiceId: string }) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { data: payments, isLoading } = usePayments(invoiceId);
  const { data: invoice } = useInvoice(invoiceId);
  const deletePayment = useDeletePayment();
  const currency = invoice
    ? getInvoiceCurrency(
        invoice as any,
        (invoice as any).organization?.defaultCurrency
      )
    : 'USD';

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deletePayment.mutateAsync(deleteId);
      toast.success('Payment deleted successfully');
      setDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete payment');
    }
  };

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!payments || payments.length === 0) {
    return (
      <p className='text-muted-foreground text-sm'>No payments recorded</p>
    );
  }

  return (
    <>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className='text-right'>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const isFailed = payment.stripeStatus === 'failed';
              const hasRetry =
                payment.retryStatus && payment.retryStatus !== 'exhausted';
              const retryCount = payment.retryCount || 0;
              const maxRetries = payment.maxRetries || 3;

              // Check crypto payment status using shared utility functions
              const isCrypto = isCryptoPayment(payment);
              const isCryptoConfirmed = isCryptoPaymentConfirmed(payment);

              return (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.date)}</TableCell>
                  <TableCell className='font-medium'>
                    {formatCurrency(payment.amount, currency)}
                  </TableCell>
                  <TableCell>{payment.method}</TableCell>
                  <TableCell>
                    {payment.stripeStatus === 'succeeded' && (
                      <Badge variant='default' className='bg-green-600'>
                        Succeeded
                      </Badge>
                    )}
                    {payment.stripeStatus === 'pending' && (
                      <Badge variant='default' className='bg-yellow-600'>
                        Pending
                      </Badge>
                    )}
                    {isFailed && (
                      <div className='flex flex-col gap-1'>
                        <Badge variant='destructive'>Failed</Badge>
                        {hasRetry && (
                          <Badge variant='outline' className='text-xs'>
                            <IconRefresh className='mr-1 h-3 w-3' />
                            Retry {retryCount}/{maxRetries}
                          </Badge>
                        )}
                        {payment.retryStatus === 'exhausted' && (
                          <Badge
                            variant='outline'
                            className='text-muted-foreground text-xs'
                          >
                            Retries exhausted
                          </Badge>
                        )}
                      </div>
                    )}
                    {payment.stripeStatus === 'canceled' && (
                      <Badge variant='outline'>Canceled</Badge>
                    )}
                    {isCryptoConfirmed && (
                      <Badge variant='default' className='bg-green-600'>
                        Confirmed
                      </Badge>
                    )}
                    {isCrypto && !isCryptoConfirmed && (
                      <Badge variant='default' className='bg-yellow-600'>
                        Pending
                      </Badge>
                    )}
                    {!payment.stripeStatus && !isCrypto && (
                      <Badge variant='outline'>Manual</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className='max-w-xs'>
                      <TruncatedText
                        text={payment.notes || '-'}
                        maxLength={50}
                      />
                      {isFailed && payment.nextRetryAt && (
                        <div className='text-muted-foreground mt-1 text-xs'>
                          Next retry: {formatDate(payment.nextRetryAt)}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className='text-right'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='mr-1'
                      onClick={() =>
                        window.open(
                          `/api/payments/${payment.id}/receipt`,
                          '_blank'
                        )
                      }
                    >
                      <IconDownload className='h-4 w-4' />
                    </Button>
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={() => setDeleteId(payment.id)}
                    >
                      <IconTrash className='text-destructive h-4 w-4' />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
