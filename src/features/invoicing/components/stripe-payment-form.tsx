'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface StripePaymentFormProps {
  invoiceId: string;
  amount: number;
  onSuccess?: () => void;
}

export function StripePaymentForm({
  invoiceId,
  amount,
  onSuccess
}: StripePaymentFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Check for payment success redirect
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');

    if (paymentStatus === 'success') {
      toast.success('Payment processed successfully!');
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      window.history.replaceState({}, '', url.toString());
      // Trigger success callback
      onSuccess?.();
    } else if (paymentStatus === 'cancelled') {
      toast.info('Payment was cancelled');
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete('payment');
      window.history.replaceState({}, '', url.toString());
    }
  }, [onSuccess]);

  const handlePayClick = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceId,
          amount
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
      setIsLoading(false);
    }
  };

  return (
    <Button
      type='button'
      onClick={handlePayClick}
      disabled={isLoading}
      className='w-full'
    >
      {isLoading ? (
        <>
          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
          Processing...
        </>
      ) : (
        `Pay $${amount.toFixed(2)}`
      )}
    </Button>
  );
}
