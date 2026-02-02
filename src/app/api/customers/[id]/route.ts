import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { normalizeCountryCode } from '@/constants/countries';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        invoices: {
          include: {
            items: true,
            payments: true
          }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error fetching customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify customer belongs to the organization
    const existingCustomer = await prisma.customer.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!existingCustomer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to your organization' },
        { status: 404 }
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

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        email,
        phone,
        address,
        ...(addressLine1 !== undefined && {
          addressLine1: addressLine1 || null
        }),
        ...(addressLine2 !== undefined && {
          addressLine2: addressLine2 || null
        }),
        ...(city !== undefined && { city: city || null }),
        ...(state !== undefined && { state: state || null }),
        ...(postalCode !== undefined && { postalCode: postalCode || null }),
        ...(country !== undefined && {
          country: country ? normalizeCountryCode(country) : null
        }),
        ...(taxExempt !== undefined && { taxExempt }),
        ...(taxExemptionReason !== undefined && { taxExemptionReason }),
        ...(taxId !== undefined && { taxId })
      } as any
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Error updating customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;

    // Verify customer belongs to the organization and check for related invoices
    const customer = await prisma.customer.findFirst({
      where: { id, organizationId: orgId },
      include: {
        invoices: {
          select: { id: true }
        },
        recurringInvoiceTemplates: {
          select: { id: true }
        }
      }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Check if customer has invoices
    if (customer.invoices && customer.invoices.length > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete customer with existing invoices',
          details: `This customer has ${customer.invoices.length} invoice(s). Please delete or reassign the invoices before deleting this customer.`
        },
        { status: 400 }
      );
    }

    // Check if customer has recurring invoice templates
    if (
      customer.recurringInvoiceTemplates &&
      customer.recurringInvoiceTemplates.length > 0
    ) {
      return NextResponse.json(
        {
          error: 'Cannot delete customer with recurring invoice templates',
          details: `This customer has ${customer.recurringInvoiceTemplates.length} recurring invoice template(s). Please delete or reassign the templates before deleting this customer.`
        },
        { status: 400 }
      );
    }

    await prisma.customer.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting customer:', error);

    // Handle Prisma foreign key constraint error
    if (error.code === 'P2003') {
      return NextResponse.json(
        {
          error: 'Cannot delete customer',
          details:
            'This customer is associated with invoices or other records. Please delete or reassign those records first.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
