import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';

// Hard reset of Stripe Connect for an organization:
// - Deletes the connected Stripe account in Stripe
// - Clears all Stripe-related fields from the organization
// Use this sparingly (e.g. a dedicated "Danger Zone" action).
export async function POST(request: NextRequest) {
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

    if (organization.stripeAccountId) {
      try {
        await stripe.accounts.del(organization.stripeAccountId);
      } catch (error: any) {
        // If account is already deleted or doesn't exist, ignore resource_missing
        if (error.code !== 'resource_missing') {
          throw error;
        }
      }
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        stripeAccountId: null,
        stripeConnectEnabled: false,
        stripeAccountStatus: null,
        stripeOnboardingComplete: false,
        stripeAccountEmail: null
      }
    });

    return NextResponse.json({
      success: true,
      message:
        'Stripe account has been fully reset. You will need to complete Stripe onboarding again next time you connect.'
    });
  } catch (error) {
    console.error('Error resetting Stripe account:', error);
    return NextResponse.json(
      { error: 'Failed to reset Stripe account' },
      { status: 500 }
    );
  }
}
