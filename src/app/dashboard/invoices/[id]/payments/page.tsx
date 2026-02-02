'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/features/invoicing/hooks/use-invoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentsList } from '@/features/invoicing/components/payments-list';
import { PaymentForm } from '@/features/invoicing/components/payment-form';
import { StripePaymentForm } from '@/features/invoicing/components/stripe-payment-form';
import { toast } from 'sonner';
import { useCallback } from 'react';
import { useStripeConnectStatus } from '@/features/invoicing/hooks/use-stripe';
import { useInvoiceEmailLogs } from '@/features/invoicing/hooks/use-invoice-actions';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import { useQueryClient } from '@tanstack/react-query';

export default function InvoicePaymentsPage() {
  const params = useParams();
  const id = params?.id as string;
  const invoiceQuery = useInvoice(id);
  const { data: invoice, isLoading } = invoiceQuery;
  const queryClient = useQueryClient();

  // Use existing hooks for data fetching
  const { data: stripeStatus } = useStripeConnectStatus();
  const { refetch: refetchEmailLogs } = useInvoiceEmailLogs(id);

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

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  if (!invoice) {
    return <div className='p-4'>Invoice not found</div>;
  }

  // Calculate invoice totals using utility function
  const { balance } = calculateInvoiceTotals(invoice);

  return (
    <div className='space-y-6 p-6'>
      <Card>
        <CardHeader>
          <CardTitle>Payments & Receipts</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          {balance > 0 && (
            <div className='bg-muted/40 mb-2 space-y-4 rounded-md border p-4'>
              {stripeStatus?.connected && stripeStatus?.status === 'active' ? (
                <>
                  <StripePaymentForm
                    invoiceId={id}
                    amount={balance}
                    onSuccess={async () => {
                      toast.success('Payment processed successfully!');
                      await refreshPaymentData();
                    }}
                  />
                  <div className='text-muted-foreground text-sm'>
                    Or record a manual payment:
                  </div>
                </>
              ) : null}
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
    </div>
  );
}
