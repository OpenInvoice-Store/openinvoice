import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET is not set');
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: `Webhook Error: ${error.message}` },
      { status: 400 }
    );
  }

  try {
    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(paymentIntent);
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        await handleAccountUpdate(account);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { invoiceId, organizationId } = paymentIntent.metadata;

  if (!invoiceId || !organizationId) {
    console.error('Missing metadata in payment intent:', paymentIntent.id);
    return;
  }

  // Get invoice
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      organization: true,
      items: true,
      payments: true
    }
  });

  if (!invoice) {
    console.error('Invoice not found:', invoiceId);
    return;
  }

  // Check if payment already exists (idempotency check)
  const existingPayment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id }
  });

  if (existingPayment) {
    console.log('Payment already recorded:', paymentIntent.id);
    return;
  }

  // Get charge details
  const charges = await stripe.charges.list({
    payment_intent: paymentIntent.id,
    limit: 1
  });

  const charge = charges.data[0];

  // Create payment record
  const amount = paymentIntent.amount / 100; // Convert from cents

  // Ensure customer's stripeCustomerId is stored in database
  const stripeCustomerId = paymentIntent.customer as string | null;
  if (stripeCustomerId && invoice.customer) {
    // Update customer record with Stripe customer ID if not already set
    const customer = invoice.customer as any;
    if (!customer.stripeCustomerId) {
      await prisma.customer.update({
        where: { id: invoice.customerId },
        data: { stripeCustomerId } as any
      });
    }
  }

  // If payment method was saved (setup_future_usage was set), ensure it's attached to customer
  // With Stripe Connect, payment methods are saved automatically when setup_future_usage is set
  // but we should verify the customer has the stripeCustomerId stored
  if (stripeCustomerId && paymentIntent.payment_method) {
    try {
      // Verify payment method exists and is attached to customer
      const paymentMethod = await stripe.paymentMethods.retrieve(
        paymentIntent.payment_method as string
      );

      // If payment method is not attached to customer, attach it
      if (
        !paymentMethod.customer ||
        paymentMethod.customer !== stripeCustomerId
      ) {
        try {
          await stripe.paymentMethods.attach(
            paymentIntent.payment_method as string,
            {
              customer: stripeCustomerId
            }
          );
        } catch (attachError: any) {
          // If already attached, that's fine - otherwise log error
          if (attachError.code !== 'payment_method_already_attached') {
            console.error(
              '[Webhook] Error attaching payment method:',
              attachError
            );
          }
        }
      }
    } catch (error: any) {
      // Payment method might not exist yet or other error - log for debugging
      console.error(
        '[Webhook] Payment method attachment error:',
        error?.message || error
      );
    }
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      date: new Date(),
      method: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: charge?.id || null,
      stripeCustomerId: stripeCustomerId,
      stripeStatus: 'succeeded',
      notes: `Payment processed via Stripe. Payment Intent: ${paymentIntent.id}`
    }
  });

  // Fetch invoice with relations separately to avoid type issues
  const invoiceWithRelations = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      organization: true,
      items: true,
      payments: true
    }
  });

  if (!invoiceWithRelations) {
    console.error('Invoice not found after payment creation:', invoiceId);
    return;
  }

  // Calculate totals
  const totalAmount = invoiceWithRelations.items.reduce(
    (sum, item) => sum + item.price * item.quantity * (1 + item.taxRate / 100),
    0
  );
  const totalPaid =
    invoiceWithRelations.payments.reduce((sum, p) => sum + p.amount, 0) +
    amount;

  // Update invoice status
  let newStatus = invoice.status;
  if (totalPaid >= totalAmount) {
    newStatus = 'paid';
  } else if (invoice.status === 'draft') {
    newStatus = 'sent';
  }

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { status: newStatus }
  });

  // Send payment confirmation email
  if (invoiceWithRelations.customer.email) {
    try {
      let shareToken = invoiceWithRelations.shareToken;
      if (!shareToken) {
        const { randomBytes } = await import('crypto');
        shareToken = randomBytes(32).toString('base64url');
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { shareToken }
        });
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;

      const emailResult = await sendPaymentConfirmationEmail({
        to: invoiceWithRelations.customer.email,
        customerName: invoiceWithRelations.customer.name,
        invoiceNo: invoiceWithRelations.invoiceNo,
        invoiceUrl,
        amount: payment.amount,
        paymentDate: payment.date,
        organizationName: invoiceWithRelations.organization?.name
      });

      await prisma.emailLog.create({
        data: {
          invoiceId,
          emailType: 'payment_confirmation',
          recipient: invoiceWithRelations.customer.email,
          status: 'sent',
          resendId: emailResult.id || null
        }
      });
    } catch (emailError) {
      console.error('Error sending payment confirmation email:', emailError);
    }
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const { invoiceId, organizationId } = paymentIntent.metadata;

  if (!invoiceId) {
    return;
  }

  // Extract failure information for logging
  const lastPaymentError = paymentIntent.last_payment_error;
  const failureReason = lastPaymentError?.message || 'Payment failed';
  const failureCode = lastPaymentError?.code || 'unknown_error';

  // Check if payment record exists
  let payment = await prisma.payment.findFirst({
    where: { stripePaymentIntentId: paymentIntent.id }
  });

  // Calculate next retry time (exponential backoff: 1h, 6h, 24h)
  const retryIntervals = [1, 6, 24]; // hours
  const retryCount = payment?.retryCount || 0;
  const nextRetryHours =
    retryIntervals[Math.min(retryCount, retryIntervals.length - 1)];
  const nextRetryAt = new Date();
  nextRetryAt.setHours(nextRetryAt.getHours() + nextRetryHours);

  if (payment) {
    // Update existing payment record
    const maxRetries = payment.maxRetries || 3;
    const shouldRetry = retryCount < maxRetries;

    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripeStatus: 'failed',
        retryCount: retryCount + 1,
        lastRetryAt: new Date(),
        nextRetryAt: shouldRetry ? nextRetryAt : null,
        retryStatus: shouldRetry ? 'scheduled' : 'exhausted',
        notes: payment.notes
          ? `${payment.notes}\nFailed: ${failureReason} (${failureCode})`
          : `Payment failed: ${failureReason} (${failureCode})`
      } as any
    });
  } else {
    // Create new payment record for failed payment (for tracking)
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true }
    });

    if (!invoice) {
      console.error('Invoice not found for failed payment:', invoiceId);
      return;
    }

    const amount = paymentIntent.amount / 100; // Convert from cents
    const maxRetries = 3;
    const shouldRetry = retryCount < maxRetries;

    payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount,
        date: new Date(),
        method: 'stripe',
        stripePaymentIntentId: paymentIntent.id,
        stripeCustomerId: paymentIntent.customer as string | null,
        stripeStatus: 'failed',
        retryCount: 0,
        lastRetryAt: new Date(),
        nextRetryAt: shouldRetry ? nextRetryAt : null,
        retryStatus: shouldRetry ? 'scheduled' : null,
        maxRetries,
        notes: `Payment failed: ${failureReason} (${failureCode})`
      } as any
    });
  }

  console.log(
    'Payment failed for invoice:',
    invoiceId,
    paymentIntent.id,
    failureCode,
    failureReason,
    `Retry ${retryCount + 1}/${payment.maxRetries || 3}`
  );
}

async function handleAccountUpdate(account: Stripe.Account) {
  // Update organization status when Stripe account is updated
  const organization = await prisma.organization.findFirst({
    where: { stripeAccountId: account.id }
  });

  if (organization) {
    const org = organization as any;
    const isComplete = account.details_submitted && account.charges_enabled;
    const status = isComplete
      ? 'active'
      : account.details_submitted
        ? 'pending'
        : 'incomplete';

    // Preserve manual disconnects:
    // - stripeOnboardingComplete tracks if the account has EVER been fully complete
    // - stripeConnectEnabled is whether the org currently allows Stripe payments
    const wasEverComplete = org.stripeOnboardingComplete;
    const currentlyEnabled = org.stripeConnectEnabled;

    // Only auto-enable the first time the account becomes complete.
    // If the user has manually disconnected (enabled === false after completion),
    // do not turn it back on automatically on future updates.
    const shouldEnable = isComplete && (currentlyEnabled || !wasEverComplete);

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        stripeAccountStatus: status,
        stripeConnectEnabled: shouldEnable,
        stripeOnboardingComplete: wasEverComplete || isComplete,
        stripeAccountEmail: account.email || org.stripeAccountEmail
      }
    });
  }
}
