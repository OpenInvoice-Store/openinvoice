import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { stripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';

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

    if (!organization.stripeAccountId) {
      return NextResponse.json({
        success: true,
        message: 'No Stripe account connected'
      });
    }

    // Delete the Stripe account (or you might want to just disable it)
    try {
      await stripe.accounts.del(organization.stripeAccountId);
    } catch (error: any) {
      // If account is already deleted or doesn't exist, that's fine
      if (error.code !== 'resource_missing') {
        throw error;
      }
    }

    // Clear Stripe connection from database
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
      message: 'Stripe account disconnected successfully'
    });
  } catch (error) {
    console.error('Error disconnecting Stripe account:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Stripe account' },
      { status: 500 }
    );
  }
}
