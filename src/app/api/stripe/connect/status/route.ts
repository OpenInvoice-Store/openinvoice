import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!organization.stripeAccountId) {
      return NextResponse.json({
        connected: false,
        status: null
      });
    }

    try {
      // Retrieve account from Stripe
      const account = await stripe.accounts.retrieve(
        organization.stripeAccountId
      );

      // Update organization with latest status
      const isComplete = account.details_submitted && account.charges_enabled;
      const status = isComplete
        ? 'active'
        : account.details_submitted
          ? 'pending'
          : 'incomplete';

      await prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeAccountStatus: status,
          stripeConnectEnabled: isComplete,
          stripeOnboardingComplete: isComplete,
          stripeAccountEmail: account.email || organization.stripeAccountEmail
        }
      });

      return NextResponse.json({
        connected: true,
        accountId: account.id,
        status,
        email: account.email,
        detailsSubmitted: account.details_submitted,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled
      });
    } catch (error: any) {
      // If account doesn't exist or was deleted
      if (error.code === 'resource_missing') {
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            stripeAccountId: null,
            stripeConnectEnabled: false,
            stripeAccountStatus: null
          }
        });

        return NextResponse.json({
          connected: false,
          status: null
        });
      }

      throw error;
    }
  } catch (error) {
    console.error('Error checking Stripe Connect status:', error);
    return NextResponse.json(
      { error: 'Failed to check Stripe Connect status' },
      { status: 500 }
    );
  }
}
