import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/tax/profiles
 * List all tax profiles for the organization
 */
export async function GET(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const taxProfiles = await prisma.taxProfile.findMany({
      where: { organizationId: orgId },
      include: {
        taxRules: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });

    return NextResponse.json(taxProfiles);
  } catch (error) {
    console.error('Error fetching tax profiles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax profiles' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tax/profiles
 * Create a new tax profile
 */
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, countryCode, regionCode, isDefault, taxRules } = body;

    if (
      !name ||
      !countryCode ||
      !taxRules ||
      !Array.isArray(taxRules) ||
      taxRules.length === 0
    ) {
      return NextResponse.json(
        { error: 'Name, countryCode, and at least one tax rule are required' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.taxProfile.updateMany({
        where: { organizationId: orgId, isDefault: true },
        data: { isDefault: false }
      });
    }

    // Create tax profile with rules
    const taxProfile = await prisma.taxProfile.create({
      data: {
        organizationId: orgId,
        name,
        countryCode,
        regionCode: regionCode || null,
        isDefault: isDefault || false,
        taxRules: {
          create: taxRules.map((rule: any) => ({
            name: rule.name,
            rate: parseFloat(rule.rate),
            authority: rule.authority || null,
            isActive: rule.isActive !== false
          }))
        }
      },
      include: {
        taxRules: true
      }
    });

    // If this is the default, update organization
    if (isDefault) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { defaultTaxProfileId: taxProfile.id }
      });
    }

    return NextResponse.json(taxProfile, { status: 201 });
  } catch (error) {
    console.error('Error creating tax profile:', error);
    return NextResponse.json(
      { error: 'Failed to create tax profile' },
      { status: 500 }
    );
  }
}
