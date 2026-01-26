import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET - Get branding settings for the organization
 */
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
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        fontFamily: true,
        companyAddress: true,
        companyPhone: true,
        companyEmail: true,
        companyWebsite: true,
        footerText: true,
        defaultCurrency: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error) {
    console.error('Error fetching branding settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch branding settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update branding settings for the organization
 */
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
    const {
      logoUrl,
      primaryColor,
      secondaryColor,
      fontFamily,
      companyAddress,
      companyPhone,
      companyEmail,
      companyWebsite,
      footerText,
      defaultCurrency
    } = body;

    // Validate color format if provided
    if (primaryColor && !/^#[0-9A-F]{6}$/i.test(primaryColor)) {
      return NextResponse.json(
        { error: 'Primary color must be a valid hex color (e.g., #FF5733)' },
        { status: 400 }
      );
    }

    if (secondaryColor && !/^#[0-9A-F]{6}$/i.test(secondaryColor)) {
      return NextResponse.json(
        { error: 'Secondary color must be a valid hex color (e.g., #FF5733)' },
        { status: 400 }
      );
    }

    // Validate email format if provided
    if (companyEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
      return NextResponse.json(
        { error: 'Company email must be a valid email address' },
        { status: 400 }
      );
    }

    // Validate URL format if provided
    if (
      companyWebsite &&
      !/^https?:\/\/.+\..+/.test(companyWebsite) &&
      companyWebsite !== ''
    ) {
      return NextResponse.json(
        { error: 'Company website must be a valid URL' },
        { status: 400 }
      );
    }

    // Validate currency code if provided
    if (defaultCurrency) {
      const validCurrencyCodes = [
        'USD',
        'EUR',
        'GBP',
        'JPY',
        'AUD',
        'CAD',
        'CHF',
        'CNY',
        'INR',
        'SGD',
        'HKD',
        'NZD',
        'MXN',
        'BRL',
        'ZAR',
        'SEK',
        'NOK',
        'DKK',
        'PLN',
        'AED'
      ];
      if (!validCurrencyCodes.includes(defaultCurrency)) {
        return NextResponse.json(
          { error: 'Invalid currency code' },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (logoUrl !== undefined) updateData.logoUrl = logoUrl || null;
    if (primaryColor !== undefined)
      updateData.primaryColor = primaryColor || null;
    if (secondaryColor !== undefined)
      updateData.secondaryColor = secondaryColor || null;
    if (fontFamily !== undefined) updateData.fontFamily = fontFamily || null;
    if (companyAddress !== undefined)
      updateData.companyAddress = companyAddress || null;
    if (companyPhone !== undefined)
      updateData.companyPhone = companyPhone || null;
    if (companyEmail !== undefined)
      updateData.companyEmail = companyEmail || null;
    if (companyWebsite !== undefined)
      updateData.companyWebsite = companyWebsite || null;
    if (footerText !== undefined) updateData.footerText = footerText || null;
    if (defaultCurrency !== undefined)
      updateData.defaultCurrency = defaultCurrency;

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        id: true,
        name: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        fontFamily: true,
        companyAddress: true,
        companyPhone: true,
        companyEmail: true,
        companyWebsite: true,
        footerText: true,
        defaultCurrency: true
      }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating branding settings:', error);
    return NextResponse.json(
      { error: 'Failed to update branding settings' },
      { status: 500 }
    );
  }
}
