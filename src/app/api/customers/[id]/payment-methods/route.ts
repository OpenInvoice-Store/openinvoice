import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';

/**
 * GET /api/customers/[id]/payment-methods
 * Get customer's saved payment methods and preferences
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify customer belongs to organization
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // If no Stripe customer ID, return empty list
    if (!customer.stripeCustomerId) {
      return NextResponse.json({
        paymentMethods: [],
        preferredPaymentMethodId: customer.preferredPaymentMethodId || null
      });
    }

    // Fetch payment methods from Stripe
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customer.stripeCustomerId,
        type: 'card'
      });

      return NextResponse.json({
        paymentMethods: paymentMethods.data.map((pm) => ({
          id: pm.id,
          type: pm.type,
          card: pm.card
            ? {
                brand: pm.card.brand,
                last4: pm.card.last4,
                expMonth: pm.card.exp_month,
                expYear: pm.card.exp_year
              }
            : null,
          billingDetails: pm.billing_details
        })),
        preferredPaymentMethodId: customer.preferredPaymentMethodId || null
      });
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return NextResponse.json({
        paymentMethods: [],
        preferredPaymentMethodId: customer.preferredPaymentMethodId || null,
        error: 'Failed to fetch payment methods'
      });
    }
  } catch (error) {
    console.error('Error fetching customer payment methods:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/customers/[id]/payment-methods
 * Set customer's preferred payment method
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { preferredPaymentMethodId } = body;

    // Verify customer belongs to organization
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    // If setting a preferred method, verify it exists and belongs to customer
    if (preferredPaymentMethodId) {
      if (!customer.stripeCustomerId) {
        return NextResponse.json(
          { error: 'Customer has no saved payment methods' },
          { status: 400 }
        );
      }

      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(
          preferredPaymentMethodId
        );

        if (paymentMethod.customer !== customer.stripeCustomerId) {
          return NextResponse.json(
            { error: 'Payment method does not belong to this customer' },
            { status: 403 }
          );
        }
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid payment method' },
          { status: 400 }
        );
      }
    }

    // Update preferred payment method
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: {
        preferredPaymentMethodId: preferredPaymentMethodId || null
      }
    });

    return NextResponse.json({
      preferredPaymentMethodId: updatedCustomer.preferredPaymentMethodId
    });
  } catch (error) {
    console.error('Error updating payment method preference:', error);
    return NextResponse.json(
      { error: 'Failed to update payment method preference' },
      { status: 500 }
    );
  }
}
