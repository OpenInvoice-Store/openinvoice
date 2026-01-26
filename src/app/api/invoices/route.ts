import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { ensureUserAndOrganization } from '@/lib/clerk-sync';

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
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        ...(status && { status }),
        ...(customerId && { customerId })
      },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoices' },
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
    const { customerId, dueDate, issueDate, status, notes, templateId, items } =
      body;

    if (!customerId || !dueDate || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Customer, due date, and items are required' },
        { status: 400 }
      );
    }

    // Verify customer belongs to the organization
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, organizationId: orgId }
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Get default template if templateId not provided (before transaction)
    let finalTemplateId = templateId;
    if (!finalTemplateId) {
      const defaultTemplate = await (prisma as any).invoiceTemplate.findFirst({
        where: {
          organizationId: orgId,
          isDefault: true,
          isActive: true
        }
      });
      finalTemplateId = defaultTemplate?.id || null;
    }

    // Create invoice with atomic counter increment
    // Single transaction, no retries needed, zero race conditions
    const invoice = await prisma.$transaction(
      async (tx) => {
        // Atomically increment counter (or create if doesn't exist)
        const counter = await tx.invoiceCounter.upsert({
          where: { organizationId: orgId },
          update: { lastInvoiceNo: { increment: 1 } },
          create: { organizationId: orgId, lastInvoiceNo: 1 }
        });

        // Create invoice with the generated number
        return await tx.invoice.create({
          data: {
            invoiceNo: counter.lastInvoiceNo,
            customerId,
            organizationId: orgId,
            dueDate: new Date(dueDate),
            issueDate: issueDate ? new Date(issueDate) : new Date(),
            status: status || 'draft',
            notes,
            ...(finalTemplateId && { templateId: finalTemplateId }),
            items: {
              create: items.map((item: any) => ({
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
            }
          }
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000
      }
    );

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice:', error);

    // Provide user-friendly error messages
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Invoice number conflict. Please try again.' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to create invoice'
      },
      { status: 500 }
    );
  }
}
