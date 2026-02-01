import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';

// Enable Stripe payments in the app for an organization that already has
// a connected Stripe account. This does NOT create a new account; it simply
// re-enables payments on our side after verifying the Stripe account is ready.
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

    const org = organization as any;

    if (!org.stripeAccountId) {
      return NextResponse.json(
        {
          error:
            'No Stripe account is currently connected. Please connect a Stripe account first.'
        },
        { status: 400 }
      );
    }

    // Retrieve the connected account from Stripe
    let account;
    try {
      account = await stripe.accounts.retrieve(org.stripeAccountId);
    } catch (error: any) {
      if (error.code === 'resource_missing') {
        // Account was deleted in Stripe – clear local fields
        await prisma.organization.update({
          where: { id: orgId },
          data: {
            stripeAccountId: null,
            stripeConnectEnabled: false,
            stripeAccountStatus: null,
            stripeOnboardingComplete: false,
            stripeAccountEmail: null
          } as any
        });

        return NextResponse.json(
          {
            error:
              'The connected Stripe account no longer exists. Please connect a new Stripe account.'
          },
          { status: 400 }
        );
      }

      throw error;
    }

    const isComplete = account.details_submitted && account.charges_enabled;

    if (!isComplete) {
      return NextResponse.json(
        {
          error:
            'Your Stripe account is not ready to accept payments. Please click "Update Connection" to complete onboarding in Stripe, then try again.'
        },
        { status: 400 }
      );
    }

    await prisma.organization.update({
      where: { id: orgId },
      data: {
        stripeAccountStatus: 'active',
        stripeConnectEnabled: true,
        stripeOnboardingComplete: true,
        stripeAccountEmail: account.email || org.stripeAccountEmail
      } as any
    });

    return NextResponse.json({
      success: true,
      message: 'Stripe payments have been re-enabled for this organization.'
    });
  } catch (error) {
    console.error('Error enabling Stripe account:', error);
    return NextResponse.json(
      { error: 'Failed to enable Stripe account' },
      { status: 500 }
    );
  }
}
