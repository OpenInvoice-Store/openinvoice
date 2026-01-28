import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/tax/profiles/[id]
 * Get a specific tax profile
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const taxProfile = await prisma.taxProfile.findFirst({
      where: { id, organizationId: orgId },
      include: {
        taxRules: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!taxProfile) {
      return NextResponse.json(
        { error: 'Tax profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(taxProfile);
  } catch (error) {
    console.error('Error fetching tax profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tax profile' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/tax/profiles/[id]
 * Update a tax profile
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, countryCode, regionCode, isDefault, taxRules } = body;

    // Verify tax profile belongs to organization
    const existingProfile = await prisma.taxProfile.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Tax profile not found' },
        { status: 404 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault && !existingProfile.isDefault) {
      await prisma.taxProfile.updateMany({
        where: { organizationId: orgId, isDefault: true, id: { not: id } },
        data: { isDefault: false }
      });
    }

    // Update tax profile
    const taxProfile = await prisma.taxProfile.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(countryCode !== undefined && { countryCode }),
        ...(regionCode !== undefined && { regionCode: regionCode || null }),
        ...(isDefault !== undefined && { isDefault })
      },
      include: {
        taxRules: true
      }
    });

    // Update tax rules if provided
    if (taxRules && Array.isArray(taxRules)) {
      // Delete existing rules
      await prisma.taxRule.deleteMany({
        where: { taxProfileId: id }
      });

      // Create new rules
      if (taxRules.length > 0) {
        await prisma.taxRule.createMany({
          data: taxRules.map((rule: any) => ({
            taxProfileId: id,
            name: rule.name,
            rate: parseFloat(rule.rate),
            authority: rule.authority || null,
            isActive: rule.isActive !== false
          }))
        });
      }

      // Reload with new rules
      const updatedProfile = await prisma.taxProfile.findUnique({
        where: { id },
        include: {
          taxRules: {
            orderBy: { createdAt: 'asc' }
          }
        }
      });

      // If this is the default, update organization
      if (isDefault) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { defaultTaxProfileId: id }
        });
      }

      return NextResponse.json(updatedProfile);
    }

    // If this is the default, update organization
    if (isDefault) {
      await prisma.organization.update({
        where: { id: orgId },
        data: { defaultTaxProfileId: id }
      });
    }

    return NextResponse.json(taxProfile);
  } catch (error) {
    console.error('Error updating tax profile:', error);
    return NextResponse.json(
      { error: 'Failed to update tax profile' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tax/profiles/[id]
 * Delete a tax profile
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify tax profile belongs to organization
    const existingProfile = await prisma.taxProfile.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Tax profile not found' },
        { status: 404 }
      );
    }

    // Check if this is the default profile
    if (existingProfile.isDefault) {
      // Unset default from organization
      await prisma.organization.update({
        where: { id: orgId },
        data: { defaultTaxProfileId: null }
      });
    }

    // Delete tax profile (cascade will delete tax rules)
    await prisma.taxProfile.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting tax profile:', error);
    return NextResponse.json(
      { error: 'Failed to delete tax profile' },
      { status: 500 }
    );
  }
}
