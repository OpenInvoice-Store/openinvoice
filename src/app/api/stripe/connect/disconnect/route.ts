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

    // Soft disconnect: keep the Stripe account but disable it in our app
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        stripeConnectEnabled: false
      }
    });

    return NextResponse.json({
      success: true,
      message:
        'Stripe account disconnected in app. The Stripe account remains active in Stripe.'
    });
  } catch (error) {
    console.error('Error disconnecting Stripe account:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Stripe account' },
      { status: 500 }
    );
  }
}
