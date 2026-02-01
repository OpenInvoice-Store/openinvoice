'use client';

import { useState, useEffect } from 'react';
import { loadStripe, StripeElementsOptions } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';

// Initialize Stripe
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

interface StripePaymentFormProps {
  invoiceId: string;
  amount: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

function PaymentFormContent({
  invoiceId,
  amount,
  onSuccess,
  onCancel,
  clientSecret: providedClientSecret
}: StripePaymentFormProps & { clientSecret: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentElementReady, setIsPaymentElementReady] = useState(false);

  // Catch unhandled PaymentElement errors
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Check if it's a Stripe PaymentElement error
      if (
        event.message &&
        (event.message.includes('payment Element') ||
          event.message.includes('elements/sessions'))
      ) {
        console.error('Payment Element load error caught:', event);
        const errorMessage =
          'Failed to load payment form. This may be due to account setup issues. Please contact support or try again later.';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Catch unhandled promise rejections from Stripe
      if (
        event.reason &&
        (event.reason.message?.includes('elements') ||
          event.reason.message?.includes('payment'))
      ) {
        console.error('Payment Element promise rejection:', event.reason);
        const errorMessage =
          'Payment form initialization failed. Please refresh the page and try again.';
        setError(errorMessage);
        toast.error(errorMessage);
      }
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
    };
  }, []);

  // Handle PaymentElement events
  const handlePaymentElementChange = (event: any) => {
    if (event.error) {
      const errorMessage = event.error.message || 'Payment element error';
      setError(errorMessage);
      // Log all errors for debugging
      console.error('Payment Element error:', event.error);
      // Show toast for critical errors
      if (
        event.error.type === 'api_connection_error' ||
        event.error.type === 'invalid_request_error'
      ) {
        toast.error(errorMessage);
      }
    } else {
      setError(null);
    }
  };

  const handlePaymentElementReady = () => {
    setIsPaymentElementReady(true);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !providedClientSecret) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || 'Payment submission failed');
        setIsProcessing(false);
        return;
      }

      const { error: confirmError } = await stripe.confirmPayment({
        elements,
        clientSecret: providedClientSecret,
        confirmParams: {
          // Use current page URL for return (works for both dashboard and public invoice pages)
          return_url: `${window.location.origin}${window.location.pathname}?payment=success`
        },
        redirect: 'if_required'
      });

      if (confirmError) {
        setError(confirmError.message || 'Payment failed');
        toast.error(confirmError.message || 'Payment failed');
      } else {
        toast.success('Payment processed successfully!');
        onSuccess?.();
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during payment');
      toast.error(err.message || 'An error occurred during payment');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      {error && (
        <Alert variant='destructive'>
          <XCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <PaymentElement
        onChange={handlePaymentElementChange}
        onReady={handlePaymentElementReady}
      />

      <p className='text-muted-foreground pt-2 text-xs'>
        Card details are securely handled by Stripe. For faster checkout, Stripe
        may save this card to your profile for future payments with this
        organization.
      </p>

      <div className='flex gap-2 pt-4'>
        <Button
          type='submit'
          disabled={
            isProcessing || !stripe || !elements || !isPaymentElementReady
          }
        >
          {isProcessing ? (
            <>
              <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              Processing...
            </>
          ) : (
            `Pay $${amount.toFixed(2)}`
          )}
        </Button>
        {onCancel && (
          <Button
            type='button'
            variant='outline'
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

export function StripePaymentForm(props: StripePaymentFormProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Create payment intent when component mounts
    let isMounted = true;
    const abortController = new AbortController();

    const createPaymentIntent = async () => {
      try {
        const response = await fetch('/api/stripe/payment-intent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            invoiceId: props.invoiceId,
            amount: props.amount
          }),
          signal: abortController.signal
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to create payment intent');
        }

        const data = await response.json();
        if (isMounted) {
          setClientSecret(data.clientSecret);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError' && isMounted) {
          setError(err.message || 'Failed to initialize payment');
        }
      }
    };

    createPaymentIntent();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [props.invoiceId, props.amount]);

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return (
      <Alert variant='destructive'>
        <AlertDescription>
          Stripe is not configured. Please contact support.
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    return (
      <Alert variant='destructive'>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!clientSecret) {
    return (
      <div className='flex items-center justify-center p-8'>
        <Loader2 className='h-6 w-6 animate-spin' />
        <span className='ml-2'>Initializing payment...</span>
      </div>
    );
  }

  const options: StripeElementsOptions = {
    clientSecret,
    appearance: {
      theme: 'stripe'
    }
    // For Stripe Connect, ensure we're using the platform's publishable key
    // The client secret from connected account payment intents works with platform key
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay with Card</CardTitle>
        <CardDescription>Secure payment processed by Stripe</CardDescription>
      </CardHeader>
      <CardContent>
        <Elements stripe={stripePromise} options={options}>
          <PaymentFormContent {...props} clientSecret={clientSecret} />
        </Elements>
      </CardContent>
    </Card>
  );
}
