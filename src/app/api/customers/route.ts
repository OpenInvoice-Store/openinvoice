import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserAndOrganization } from '@/lib/clerk-sync';
import { normalizeCountryCode } from '@/constants/countries';

export async function GET(request: NextRequest) {
  try {
    // Ensure user and organization exist in DB (fallback if webhook failed)
    const orgId = await ensureUserAndOrganization();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';

    const customers = await prisma.customer.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(customers);
  } catch (error) {
    console.error('Error fetching customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure user and organization exist in DB (fallback if webhook failed)
    const orgId = await ensureUserAndOrganization();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      email,
      phone,
      address,
      addressLine1,
      addressLine2,
      city,
      state,
      postalCode,
      country,
      taxExempt,
      taxExemptionReason,
      taxId
    } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        email,
        phone,
        address,
        addressLine1: addressLine1 || undefined,
        addressLine2: addressLine2 || undefined,
        city: city || undefined,
        state: state || undefined,
        postalCode: postalCode || undefined,
        country: country ? normalizeCountryCode(country) : undefined,
        organizationId: orgId,
        ...(taxExempt !== undefined && { taxExempt }),
        ...(taxExemptionReason !== undefined && { taxExemptionReason }),
        ...(taxId !== undefined && { taxId })
      } as any
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
