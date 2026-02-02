import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe, calculatePlatformFee } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import { getInvoiceCurrency } from '@/lib/currency';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';

export async function POST(request: NextRequest) {
  try {
    // Get auth, but don't require it (allow guest access via share links)
    let orgId: string | null = null;
    try {
      const authResult = await auth();
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
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId
      },
      include: {
        customer: true,
        organization: true,
        items: true,
        payments: true,
        invoiceTaxes: true
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check access permissions
    const hasShareToken = !!invoice.shareToken;
    const isAuthenticated =
      orgId && typeof orgId === 'string' && orgId.length > 0;

    if (hasShareToken) {
      // Invoice has shareToken - allow access
    } else if (isAuthenticated) {
      if (invoice.organizationId !== orgId) {
        return NextResponse.json(
          {
            error: 'Invoice not found or does not belong to your organization'
          },
          { status: 404 }
        );
      }
    } else {
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

    // Calculate invoice totals
    const invoiceTotals = calculateInvoiceTotals(invoice as any);
    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = invoiceTotals.balance;

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

    // Get currency
    const invoiceCurrency = getInvoiceCurrency(
      invoice as any,
      (org as any)?.defaultCurrency
    ).toLowerCase();

    // Get base URL for redirects
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Determine return URL based on whether user is authenticated or using share link
    let returnUrl = `${baseUrl}/invoice/${invoice.shareToken || invoiceId}?payment=success`;
    if (isAuthenticated) {
      returnUrl = `${baseUrl}/dashboard/invoices/${invoiceId}/payments?payment=success`;
    }

    // Create Checkout Session
    // For Stripe Connect, we create the session on the platform account
    // and use payment_intent_data to route to connected account
    const sessionParams: any = {
      payment_method_types: ['card'], // Cards are always supported
      line_items: [
        {
          price_data: {
            currency: invoiceCurrency,
            product_data: {
              name: `Invoice #${invoice.invoiceNo}`,
              description: `Payment for Invoice #${invoice.invoiceNo}`
            },
            unit_amount: amountInCents
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: returnUrl,
      cancel_url: returnUrl.replace('payment=success', 'payment=cancelled'),
      metadata: {
        invoiceId,
        invoiceNo: invoice.invoiceNo.toString(),
        organizationId: invoice.organizationId,
        customerId: invoice.customerId
      },
      // For Stripe Connect, configure payment to go to connected account
      payment_intent_data: {
        on_behalf_of: org.stripeAccountId,
        transfer_data: {
          destination: org.stripeAccountId,
          ...(platformFee > 0 ? { amount: amountInCents - platformFee } : {})
        },
        ...(platformFee > 0 ? { application_fee_amount: platformFee } : {}),
        metadata: {
          invoiceId,
          invoiceNo: invoice.invoiceNo.toString(),
          organizationId: invoice.organizationId,
          customerId: invoice.customerId
        }
      },
      // Enable automatic payment methods (Google Pay, Apple Pay, etc.)
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic'
        }
      },
      // Customer information
      customer_email: invoice.customer.email || undefined,
      // Allow promotion codes
      allow_promotion_codes: true,
      // Enable automatic tax if configured
      ...(org.stripeTaxEnabled && !invoiceTotals.totalTax
        ? { automatic_tax: { enabled: true } }
        : {})
    };

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionParams);

    if (!session.url) {
      return NextResponse.json(
        {
          error: 'Failed to create checkout session - no URL returned'
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}
