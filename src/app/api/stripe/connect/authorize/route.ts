import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { orgId, userId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    // Get current user to get email
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - User not found' },
        { status: 401 }
      );
    }

    // Get user's primary email
    const userEmail =
      user.emailAddresses?.find(
        (email) => email.id === user.primaryEmailAddressId
      )?.emailAddress || user.emailAddresses?.[0]?.emailAddress;

    if (!userEmail) {
      return NextResponse.json(
        { error: 'User email is required to connect Stripe account' },
        { status: 400 }
      );
    }

    // Get organization with all fields
    const organization = await prisma.organization.findUnique({
      where: { id: orgId }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get the base URL for redirect
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const returnUrl = `${baseUrl}/dashboard/settings?stripe_connected=true`;
    const refreshUrl = `${baseUrl}/dashboard/settings?stripe_refresh=true`;

    // Create or reuse a Stripe Connect account, then generate an onboarding link.
    // We always drive the user through Stripe's onboarding/update flow so they
    // can either complete setup or review/update existing details.
    let accountId = organization.stripeAccountId;

    // If we have an existing account ID, verify it still exists in Stripe.
    if (accountId) {
      try {
        await stripe.accounts.retrieve(accountId);
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          // Account was deleted in Stripe – treat as no account and recreate.
          accountId = null;
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
        } else {
          throw error;
        }
      }
    }

    // Create a new account if it doesn't exist
    if (!accountId) {
      // Get country from organization or fallback to environment variable or 'US'
      const country =
        organization.country || process.env.STRIPE_DEFAULT_COUNTRY || 'US';

      const account = await stripe.accounts.create({
        type: 'express',
        country: country.toUpperCase(), // Ensure uppercase (e.g., 'us' -> 'US')
        email: userEmail, // Use the authenticated user's email
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });

      accountId = account.id;

      // Save account ID to database
      await prisma.organization.update({
        where: { id: orgId },
        data: {
          stripeAccountId: accountId,
          stripeAccountStatus: 'pending',
          stripeAccountEmail: account.email || null,
          stripeOnboardingComplete: false,
          stripeConnectEnabled: false
        }
      });
    }

    // Create account link for onboarding or updating details
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding'
    });

    return NextResponse.json({
      url: accountLink.url,
      accountId
    });
  } catch (error) {
    console.error('Error creating Stripe Connect authorization:', error);
    return NextResponse.json(
      { error: 'Failed to create Stripe Connect authorization' },
      { status: 500 }
    );
  }
}
