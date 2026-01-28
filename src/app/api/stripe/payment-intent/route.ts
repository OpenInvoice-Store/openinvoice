import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe, calculatePlatformFee } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { getInvoiceCurrency } from '@/lib/currency';

export async function POST(request: NextRequest) {
  try {
    // Get auth, but don't require it (allow guest access via share links)
    // For guest users accessing via share links, orgId will be null/undefined
    let orgId: string | null = null;
    try {
      const authResult = await auth();
      // Only set orgId if it's a valid non-empty string
      if (
        authResult?.orgId &&
        typeof authResult.orgId === 'string' &&
        authResult.orgId.length > 0
      ) {
        orgId = authResult.orgId;
      } else {
        orgId = null;
      }
    } catch (error) {
      // User is not authenticated (guest access) - this is allowed for share links
      orgId = null;
    }

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

    // Priority: If invoice has shareToken, allow access regardless of auth status
    // This enables guest payments via share links
    const hasShareToken = !!invoice.shareToken;
    const isAuthenticated =
      orgId && typeof orgId === 'string' && orgId.length > 0;

    if (hasShareToken) {
      // Invoice has shareToken - allow access (guest or authenticated)
    } else if (isAuthenticated) {
      // Authenticated user accessing invoice without shareToken - must belong to their org
      if (invoice.organizationId !== orgId) {
        return NextResponse.json(
          {
            error: 'Invoice not found or does not belong to your organization'
          },
          { status: 404 }
        );
      }
    } else {
      // Guest user trying to access invoice without shareToken
      return NextResponse.json(
        {
          error:
            'This invoice is not publicly accessible. Please use the share link provided in the invoice email.'
        },
        { status: 403 }
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

    // Create or retrieve Stripe customer on the platform account.
    // For Stripe Connect, customers can be created on the platform account.
    // We always attach a customer so that Stripe can store and reuse payment
    // methods (saved cards) for this email across future payments.
    let customerId: string | null = null;

    // First, check if customer already has a stripeCustomerId in database
    const customer = await prisma.customer.findUnique({
      where: { id: invoice.customerId }
    });
    const existingStripeCustomerId = (customer as any)?.stripeCustomerId;

    if (existingStripeCustomerId) {
      // Verify the Stripe customer still exists
      try {
        await stripe.customers.retrieve(existingStripeCustomerId);
        customerId = existingStripeCustomerId;
      } catch (error) {
        // Customer doesn't exist in Stripe, will create/find below
      }
    }

    // If no valid customer ID yet, create or find one
    if (!customerId) {
      if (invoice.customer.email) {
        customerId = await getOrCreateStripeCustomerOnPlatform(
          invoice.customer.email,
          invoice.customer.name,
          invoice.customerId
        );
      } else {
        // Customer has no email - create a customer without email
        // This is less ideal but ensures we always have a customer for payment method storage
        try {
          const newStripeCustomer = await stripe.customers.create({
            name: invoice.customer.name || undefined,
            metadata: {
              localCustomerId: invoice.customerId,
              organizationId: invoice.organizationId
            }
          });
          customerId = newStripeCustomer.id;

          // Store in database
          await prisma.customer.update({
            where: { id: invoice.customerId },
            data: { stripeCustomerId: customerId } as any
          });
        } catch (error) {
          console.error(
            '[Payment Intent] Failed to create Stripe customer:',
            error
          );
          // Continue without customer - payment will still work but payment method won't be saved
        }
      }
    }

    // Note: If customerId is null, payment will still work but payment method won't be saved

    // Get preferred payment method if available (customer was already fetched above)
    const preferredPaymentMethodId =
      (customer as any)?.preferredPaymentMethodId || null;

    // Get currency from invoice or organization default
    const invoiceCurrency = getInvoiceCurrency(
      invoice as any,
      (org as any)?.defaultCurrency
    ).toLowerCase(); // Stripe requires lowercase currency codes

    // Check if Stripe Tax is enabled for this invoice/organization
    const stripeTaxEnabled =
      (invoice as any).stripeTaxEnabled || org.stripeTaxEnabled || false;
    const customerTaxExempt = (customer as any)?.taxExempt || false;

    // Calculate final amount (including Stripe Tax if enabled)
    let finalAmount = amountInCents;

    // If Stripe Tax is enabled and customer is not exempt, calculate tax
    // Note: For now, we'll use the tax amount already stored on the invoice if available
    // In a full implementation, you'd call the Tax Calculation API here
    if (
      stripeTaxEnabled &&
      !customerTaxExempt &&
      (invoice as any).totalTaxAmount
    ) {
      // Add the Stripe Tax amount to the payment amount
      const stripeTaxAmount = Math.round((invoice as any).totalTaxAmount * 100);
      finalAmount = amountInCents + stripeTaxAmount;
    }

    // For Stripe Connect Express accounts, create payment intent on PLATFORM account
    // and use on_behalf_of + transfer_data to route funds to connected account
    // This allows the client secret to work with the platform's publishable key
    const paymentIntentParams: any = {
      amount: finalAmount,
      currency: invoiceCurrency,
      customer: customerId || undefined,
      // Use preferred payment method if available
      ...(preferredPaymentMethodId && customerId
        ? { payment_method: preferredPaymentMethodId }
        : {}),
      metadata: {
        invoiceId,
        invoiceNo: invoice.invoiceNo.toString(),
        organizationId: invoice.organizationId,
        customerId: invoice.customerId,
        ...(stripeTaxEnabled && (invoice as any).totalTaxAmount
          ? {
              stripeTaxAmount: String((invoice as any).totalTaxAmount),
              stripeTaxEnabled: 'true'
            }
          : {})
      },
      description: `Payment for Invoice #${invoice.invoiceNo}`,
      // Use Stripe's automatic payment methods so the Payment Element can offer
      // multiple options (cards, wallets, bank debits) that are enabled on the
      // connected account.
      // Always enable automatic_payment_methods - Stripe will still use preferred
      // payment method if one is specified via the payment_method parameter
      automatic_payment_methods: {
        enabled: true
      },
      // Ask Stripe to save the payment method for future off-session use.
      // This enables "saved cards" in the Payment Element for this customer.
      setup_future_usage: 'off_session',
      // Use on_behalf_of to specify the connected account
      on_behalf_of: org.stripeAccountId,
      // Transfer funds to the connected account
      transfer_data: {
        destination: org.stripeAccountId
      }
    };

    // Note: Stripe Tax automatic calculation via PaymentIntent requires:
    // 1. Stripe Tax to be enabled in the Stripe Dashboard
    // 2. Customer to have a valid address
    // 3. Using the Tax Calculation API before creating the PaymentIntent
    // For now, we include the pre-calculated tax in the amount
    // Future enhancement: Use Stripe's Tax Calculation API to calculate tax dynamically

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
  name: string,
  customerDbId: string
): Promise<string | null> {
  try {
    // Check if customer already has Stripe customer ID stored
    const customer = await prisma.customer.findUnique({
      where: { id: customerDbId }
    });

    const customerStripeId = (customer as any)?.stripeCustomerId;
    if (customerStripeId) {
      // Verify the Stripe customer still exists
      try {
        await stripe.customers.retrieve(customerStripeId);
        return customerStripeId;
      } catch (error) {
        // Customer doesn't exist in Stripe, continue to create/find
      }
    }

    // Search for existing customer on platform account
    const customers = await stripe.customers.list({
      email,
      limit: 1
    });

    let stripeCustomerId: string;

    if (customers.data.length > 0) {
      stripeCustomerId = customers.data[0].id;
    } else {
      // Create new customer on platform account
      const customer = await stripe.customers.create({
        email,
        name
      });
      stripeCustomerId = customer.id;
    }

    // Store Stripe customer ID in database
    await prisma.customer.update({
      where: { id: customerDbId },
      data: { stripeCustomerId } as any
    });

    return stripeCustomerId;
  } catch (error) {
    console.error('Error creating/retrieving Stripe customer:', error);
    return null;
  }
}
