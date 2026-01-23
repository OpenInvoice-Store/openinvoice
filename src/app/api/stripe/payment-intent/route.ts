import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe, calculatePlatformFee } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();
    const body = await request.json();
    const {
      invoiceId,
      amount
    }: { invoiceId?: string; amount?: number | string } = body;

    if (!invoiceId || !amount) {
      return NextResponse.json(
        { error: 'Invoice ID and amount are required' },
        { status: 400 }
      );
    }

    // Validate amount is positive
    const amountNum = parseFloat(String(amount));
    if (isNaN(amountNum) || amountNum <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    // Get invoice and organization
    // For authenticated users, verify invoice belongs to their org
    // For guest users, just verify invoice exists (they accessed via share token)
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId
      },
      include: {
        customer: true,
        organization: true,
        items: true,
        payments: true
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // If user is authenticated, verify invoice belongs to their organization
    if (orgId && invoice.organizationId !== orgId) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Check if organization has Stripe Connect enabled
    const org = invoice.organization as any;
    if (!org.stripeAccountId || !org.stripeConnectEnabled) {
      return NextResponse.json(
        {
          error:
            'Stripe account not connected. Please connect your Stripe account in settings.'
        },
        { status: 400 }
      );
    }

    // Verify account is active
    try {
      const account = await stripe.accounts.retrieve(org.stripeAccountId);
      if (!account.charges_enabled) {
        return NextResponse.json(
          {
            error:
              'Stripe account is not ready to accept payments. Please complete onboarding.'
          },
          { status: 400 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        {
          error:
            'Stripe account not found. Please reconnect your Stripe account.'
        },
        { status: 400 }
      );
    }

    // Calculate amount in cents
    const amountInCents = Math.round(amountNum * 100);

    // Validate amount doesn't exceed invoice total (with small tolerance for rounding)
    const invoiceTotal = invoice.items.reduce(
      (sum, item) =>
        sum + item.price * item.quantity * (1 + item.taxRate / 100),
      0
    );
    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = invoiceTotal - totalPaid;

    // Allow small tolerance for rounding differences (1 cent)
    if (amountNum > remainingBalance + 0.01) {
      return NextResponse.json(
        {
          error: `Payment amount ($${amountNum.toFixed(2)}) exceeds remaining balance ($${remainingBalance.toFixed(2)})`
        },
        { status: 400 }
      );
    }

    const platformFee = calculatePlatformFee(amountInCents);

    // Create or retrieve Stripe customer on the platform account
    // For Stripe Connect, customers can be created on the platform account
    let customerId = invoice.customer.email
      ? await getOrCreateStripeCustomerOnPlatform(
          invoice.customer.email,
          invoice.customer.name
        )
      : null;

    // For Stripe Connect Express accounts, create payment intent on PLATFORM account
    // and use on_behalf_of + transfer_data to route funds to connected account
    // This allows the client secret to work with the platform's publishable key
    const paymentIntentParams: any = {
      amount: amountInCents,
      currency: 'usd', // You might want to make this configurable
      customer: customerId || undefined,
      metadata: {
        invoiceId,
        invoiceNo: invoice.invoiceNo.toString(),
        organizationId: invoice.organizationId,
        customerId: invoice.customerId
      },
      description: `Payment for Invoice #${invoice.invoiceNo}`,
      // Use on_behalf_of to specify the connected account
      on_behalf_of: org.stripeAccountId,
      // Transfer funds to the connected account
      transfer_data: {
        destination: org.stripeAccountId
      }
    };

    // Add application_fee_amount if platform fee is configured
    // When application_fee_amount is set, Stripe automatically transfers
    // (amount - application_fee_amount) to the connected account
    if (platformFee > 0) {
      paymentIntentParams.application_fee_amount = platformFee;
    } else {
      // If no platform fee, explicitly set transfer amount to full amount
      paymentIntentParams.transfer_data.amount = amountInCents;
    }

    // Create payment intent on PLATFORM account (not connected account)
    // This allows the client secret to work with platform's publishable key
    const paymentIntent =
      await stripe.paymentIntents.create(paymentIntentParams);

    // Verify payment intent was created successfully
    if (!paymentIntent.client_secret) {
      return NextResponse.json(
        {
          error: 'Failed to create payment intent - no client secret returned'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}

// Helper function to get or create Stripe customer on platform account
// For Stripe Connect, we create customers on the platform account
async function getOrCreateStripeCustomerOnPlatform(
  email: string,
  name: string
): Promise<string | null> {
  try {
    // Search for existing customer on platform account
    const customers = await stripe.customers.list({
      email,
      limit: 1
    });

    if (customers.data.length > 0) {
      return customers.data[0].id;
    }

    // Create new customer on platform account
    const customer = await stripe.customers.create({
      email,
      name
    });

    return customer.id;
  } catch (error) {
    console.error('Error creating/retrieving Stripe customer:', error);
    return null;
  }
}
