import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { calculateTax, saveInvoiceTaxes } from '@/lib/tax-calculator';

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
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: {
        customer: true,
        organization: {
          select: {
            defaultCurrency: true
          }
        },
        items: {
          include: {
            product: true
          }
        },
        payments: true,
        paymentPlan: {
          include: {
            installments: {
              include: {
                payments: true
              },
              orderBy: { installmentNumber: 'asc' }
            }
          }
        },
        invoiceTemplate: true,
        invoiceTaxes: true,
        taxProfile: {
          include: {
            taxRules: true
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice' },
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

    // Verify invoice belongs to the organization
    const existingInvoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      customerId,
      dueDate,
      issueDate,
      status,
      notes,
      templateId,
      items,
      currency,
      taxProfileId,
      taxOverrides
    } = body;

    // Verify customer belongs to the organization if customerId is being updated
    if (customerId && customerId !== existingInvoice.customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, organizationId: orgId }
      });

      if (!customer) {
        return NextResponse.json(
          {
            error: 'Customer not found or does not belong to your organization'
          },
          { status: 404 }
        );
      }
    }

    // First, delete existing items and invoice taxes
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: id }
    });
    await prisma.invoiceTax.deleteMany({
      where: { invoiceId: id }
    });

    // Calculate tax if tax profile or overrides are provided
    let taxCalculationResult = null;
    let taxCalculationMethod = 'manual';

    if (taxProfileId || taxOverrides) {
      try {
        taxCalculationResult = await calculateTax({
          items: (items || []).map((item: any) => ({
            price: parseFloat(item.price),
            quantity: parseInt(item.quantity)
          })),
          customerId: customerId || existingInvoice.customerId,
          organizationId: orgId,
          taxProfileId: taxProfileId || null,
          taxOverrides: taxOverrides || undefined
        });

        taxCalculationMethod = taxOverrides ? 'override' : 'profile';
      } catch (error) {
        console.error('Error calculating tax:', error);
      }
    }

    // Update invoice and recreate items
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        customerId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        issueDate: issueDate ? new Date(issueDate) : undefined,
        status,
        notes,
        currency: currency !== undefined ? currency : undefined,
        templateId: templateId !== undefined ? templateId || null : undefined,
        // Custom Tax System fields
        taxCalculationMethod: taxCalculationMethod,
        ...(taxProfileId !== undefined && {
          taxProfileId: taxProfileId || null
        }),
        items: {
          create: items?.map((item: any) => ({
            productId: item.productId,
            description: item.description,
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price),
            taxRate: item.taxRate ? parseFloat(item.taxRate) : 0
          }))
        }
      } as any,
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true,
        invoiceTemplate: true
      }
    });

    // Save invoice taxes if custom tax was calculated
    if (taxCalculationResult && taxCalculationResult.taxes.length > 0) {
      await saveInvoiceTaxes(
        invoice.id,
        taxCalculationResult.taxes.map((tax) => ({
          ...tax,
          isOverride: taxCalculationMethod === 'override'
        }))
      );
    }

    // Reload invoice with taxes
    const invoiceWithTaxes = await prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true,
        invoiceTemplate: true,
        invoiceTaxes: true
      }
    });

    return NextResponse.json(invoiceWithTaxes);
  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
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

    // Verify invoice belongs to the organization
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    await prisma.invoice.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    return NextResponse.json(
      { error: 'Failed to delete invoice' },
      { status: 500 }
    );
  }
}
