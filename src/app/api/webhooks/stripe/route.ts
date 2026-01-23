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

  const payment = await prisma.payment.create({
    data: {
      invoiceId,
      amount,
      date: new Date(),
      method: 'stripe',
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: charge?.id || null,
      stripeCustomerId: paymentIntent.customer as string | null,
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
  const { invoiceId } = paymentIntent.metadata;

  if (!invoiceId) {
    return;
  }

  // Log the failure (you might want to create a payment record with failed status)
  console.log('Payment failed for invoice:', invoiceId, paymentIntent.id);
}

async function handleAccountUpdate(account: Stripe.Account) {
  // Update organization status when Stripe account is updated
  const organization = await prisma.organization.findFirst({
    where: { stripeAccountId: account.id }
  });

  if (organization) {
    const isComplete = account.details_submitted && account.charges_enabled;
    const status = isComplete
      ? 'active'
      : account.details_submitted
        ? 'pending'
        : 'incomplete';

    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        stripeAccountStatus: status,
        stripeConnectEnabled: isComplete,
        stripeOnboardingComplete: isComplete,
        stripeAccountEmail: account.email || organization.stripeAccountEmail
      }
    });
  }
}
