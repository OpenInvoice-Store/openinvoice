import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

/**
 * GET /api/organizations/taxjar
 * Get TaxJar settings for the organization
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
        taxJarEnabled: true,
        taxJarApiKey: true,
        taxJarNexusRegions: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const apiKey =
      (organization as any).taxJarApiKey || process.env.TAXJAR_API_KEY;
    const isSandbox =
      process.env.TAXJAR_USE_SANDBOX === 'true' ||
      (apiKey && apiKey.toLowerCase().includes('sandbox'));

    return NextResponse.json({
      taxJarEnabled: (organization as any).taxJarEnabled || false,
      taxJarApiKey: (organization as any).taxJarApiKey ? '***' : null, // Don't expose full API key
      hasApiKey: !!apiKey,
      isSandbox: isSandbox,
      taxJarNexusRegions: (organization as any).taxJarNexusRegions
        ? JSON.parse((organization as any).taxJarNexusRegions)
        : []
    });
  } catch (error: any) {
    console.error('Error fetching TaxJar settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch TaxJar settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/organizations/taxjar
 * Update TaxJar settings for the organization
 *
 * Request body:
 * {
 *   taxJarEnabled: boolean,
 *   taxJarApiKey?: string, // Optional - if not provided, uses env var
 *   taxJarNexusRegions?: Array<{country: string, state?: string, zip?: string, city?: string, street?: string}>
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { taxJarEnabled, taxJarApiKey, taxJarNexusRegions } = body;

    // Mutual exclusion: Disable Stripe Tax if enabling TaxJar
    if (taxJarEnabled === true) {
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: {
          stripeTaxEnabled: true
        }
      });

      if ((organization as any)?.stripeTaxEnabled) {
        await prisma.organization.update({
          where: { id: orgId },
          data: { stripeTaxEnabled: false } as any
        });
      }
    }

    // Validate nexus regions format if provided
    if (taxJarNexusRegions !== undefined) {
      if (!Array.isArray(taxJarNexusRegions)) {
        return NextResponse.json(
          { error: 'taxJarNexusRegions must be an array' },
          { status: 400 }
        );
      }

      for (const region of taxJarNexusRegions) {
        if (!region.country) {
          return NextResponse.json(
            { error: 'Each nexus region must have a country field' },
            { status: 400 }
          );
        }
      }
    }

    const updateData: any = {};

    if (taxJarEnabled !== undefined) {
      updateData.taxJarEnabled = taxJarEnabled;
    }

    if (taxJarApiKey !== undefined) {
      // Allow clearing the API key by passing null or empty string
      updateData.taxJarApiKey = taxJarApiKey || null;
    }

    if (taxJarNexusRegions !== undefined) {
      updateData.taxJarNexusRegions =
        taxJarNexusRegions.length > 0
          ? JSON.stringify(taxJarNexusRegions)
          : null;
    }

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData
    });

    return NextResponse.json({
      taxJarEnabled: (updated as any).taxJarEnabled || false,
      taxJarApiKey: (updated as any).taxJarApiKey ? '***' : null,
      hasApiKey:
        !!(updated as any).taxJarApiKey || !!process.env.TAXJAR_API_KEY,
      taxJarNexusRegions: (updated as any).taxJarNexusRegions
        ? JSON.parse((updated as any).taxJarNexusRegions)
        : []
    });
  } catch (error: any) {
    console.error('Error updating TaxJar settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update TaxJar settings' },
      { status: 500 }
    );
  }
}
