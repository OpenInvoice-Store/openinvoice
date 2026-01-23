import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
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
      where: { id: orgId },
      select: { country: true }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      country:
        organization.country || process.env.STRIPE_DEFAULT_COUNTRY || 'US'
    });
  } catch (error) {
    console.error('Error fetching organization country:', error);
    return NextResponse.json(
      { error: 'Failed to fetch organization country' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { country } = body;

    if (!country || typeof country !== 'string' || country.length !== 2) {
      return NextResponse.json(
        {
          error:
            'Invalid country code. Must be a 2-letter ISO code (e.g., US, CA, GB)'
        },
        { status: 400 }
      );
    }

    // Check if Stripe account is already connected
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { stripeAccountId: true }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // If Stripe account is already connected, don't allow country change
    if (organization.stripeAccountId) {
      return NextResponse.json(
        {
          error:
            'Cannot change country after Stripe account is connected. Please disconnect and reconnect with the new country.'
        },
        { status: 400 }
      );
    }

    // Update organization country
    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: { country: country.toUpperCase() },
      select: { country: true }
    });

    return NextResponse.json({
      success: true,
      country: updated.country
    });
  } catch (error) {
    console.error('Error updating organization country:', error);
    return NextResponse.json(
      { error: 'Failed to update organization country' },
      { status: 500 }
    );
  }
}
