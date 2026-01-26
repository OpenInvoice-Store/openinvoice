'use client';

import { useParams } from 'next/navigation';
import { useInvoice } from '@/features/invoicing/hooks/use-invoices';
import { formatCurrency } from '@/lib/format';
import { getInvoiceCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PaymentsList } from '@/features/invoicing/components/payments-list';
import { PaymentForm } from '@/features/invoicing/components/payment-form';
import { StripePaymentForm } from '@/features/invoicing/components/stripe-payment-form';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';

export default function InvoicePaymentsPage() {
  const params = useParams();
  const id = params?.id as string;
  const invoiceQuery = useInvoice(id);
  const { data: invoice, isLoading } = invoiceQuery;
  const [showStripePayment, setShowStripePayment] = useState(false);

  // Check Stripe Connect status
  const { data: stripeStatus } = useQuery({
    queryKey: ['stripe-connect-status'],
    queryFn: async () => {
      const response = await fetch('/api/stripe/connect/status');
      if (!response.ok) return null;
      return response.json();
    }
  });

  // Fetch email logs for refetch
  const { refetch: refetchEmailLogs } = useQuery({
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
  const currency = getInvoiceCurrency(
    invoice as any,
    (invoice as any).organization?.defaultCurrency
  );

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
                    onSuccess={() => {
                      refetchEmailLogs();
                      invoiceQuery.refetch();
                      toast.success('Payment processed successfully!');
                    }}
                    onCancel={() => undefined}
                  />
                  <div className='text-muted-foreground text-sm'>
                    Or record a manual payment:
                  </div>
                </>
              ) : null}
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

      {/* Stripe Payment Dialog */}
      <Dialog open={showStripePayment} onOpenChange={setShowStripePayment}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>Pay Invoice #{invoice.invoiceNo}</DialogTitle>
            <DialogDescription>
              Pay the remaining balance of {formatCurrency(balance, currency)}
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
