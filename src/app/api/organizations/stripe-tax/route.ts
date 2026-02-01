import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/organizations/stripe-tax
 * Get Stripe Tax settings for the organization
 */
export async function GET() {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        stripeTaxEnabled: true,
        taxRegistrationNumber: true,
        stripeAccountId: true,
        stripeConnectEnabled: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      stripeTaxEnabled: (organization as any).stripeTaxEnabled || false,
      taxRegistrationNumber:
        (organization as any).taxRegistrationNumber || null,
      stripeAccountId: (organization as any).stripeAccountId || null,
      stripeConnectEnabled: (organization as any).stripeConnectEnabled || false
    });
  } catch (error: any) {
    console.error('Error fetching Stripe Tax settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch Stripe Tax settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organizations/stripe-tax
 * Update Stripe Tax settings for the organization
 */
export async function PUT(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { stripeTaxEnabled, taxRegistrationNumber } = body;

    // Validate that Stripe Connect is enabled if trying to enable Stripe Tax
    if (stripeTaxEnabled) {
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          stripeAccountId: true,
          stripeConnectEnabled: true
        }
      });

      if (
        !organization ||
        !(organization as any).stripeAccountId ||
        !(organization as any).stripeConnectEnabled
      ) {
        return NextResponse.json(
          {
            error:
              'Stripe Connect account must be connected before enabling Stripe Tax'
          },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: {
        stripeTaxEnabled:
          stripeTaxEnabled !== undefined ? stripeTaxEnabled : undefined,
        taxRegistrationNumber:
          taxRegistrationNumber !== undefined
            ? taxRegistrationNumber
            : undefined
      } as any
    });

    return NextResponse.json({
      stripeTaxEnabled: (updated as any).stripeTaxEnabled || false,
      taxRegistrationNumber: (updated as any).taxRegistrationNumber || null
    });
  } catch (error: any) {
    console.error('Error updating Stripe Tax settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update Stripe Tax settings' },
      { status: 500 }
    );
  }
}
