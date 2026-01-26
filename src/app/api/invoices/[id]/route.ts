import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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
        invoiceTemplate: true
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
      currency
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

    // First, delete existing items
    await prisma.invoiceItem.deleteMany({
      where: { invoiceId: id }
    });

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
        items: {
          create: items?.map((item: any) => ({
            productId: item.productId,
            description: item.description,
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price),
            taxRate: item.taxRate ? parseFloat(item.taxRate) : 0
          }))
        }
      },
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

    return NextResponse.json(invoice);
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
