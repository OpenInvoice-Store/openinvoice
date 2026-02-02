import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { ensureUserAndOrganization } from '@/lib/clerk-sync';
import { calculateTax, saveInvoiceTaxes } from '@/lib/tax-calculator';

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
        payments: true,
        invoiceTaxes: true
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

    // Get organization
    const organization = await prisma.organization.findUnique({
      where: { id: orgId }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const org = organization as any;

    // Get organization's default currency if currency not provided
    let finalCurrency = currency;
    if (!finalCurrency) {
      finalCurrency = org.defaultCurrency || 'USD';
    }

    // Calculate tax using tax system (TaxJar, tax profiles, or overrides)
    let taxCalculationResult = null;
    let taxCalculationMethod = 'manual'; // Default to manual (using taxRate on items)

    // Check if TaxJar is enabled for this organization
    const taxJarEnabled = org.taxJarEnabled || false;

    // Priority: TaxJar (if enabled) > Tax Overrides > Tax Profile > Manual
    if (taxJarEnabled && !taxOverrides && !taxProfileId) {
      // Use TaxJar if enabled and no overrides/profile specified
      try {
        taxCalculationResult = await calculateTax({
          items: items.map((item: any) => ({
            price: parseFloat(item.price),
            quantity: parseInt(item.quantity),
            description: item.description,
            productTaxCode: item.productTaxCode
          })),
          customerId,
          organizationId: orgId,
          useTaxJar: true,
          shipping: 0 // Can be extended to support shipping
        });

        taxCalculationMethod = 'taxjar';
      } catch (error) {
        console.error('Error calculating tax with TaxJar:', error);
        // Fall through to tax profile or manual calculation
      }
    }

    // If TaxJar didn't work or wasn't enabled, try tax profile or overrides
    if (!taxCalculationResult && (taxProfileId || taxOverrides)) {
      try {
        taxCalculationResult = await calculateTax({
          items: items.map((item: any) => ({
            price: parseFloat(item.price),
            quantity: parseInt(item.quantity),
            description: item.description,
            productTaxCode: item.productTaxCode
          })),
          customerId,
          organizationId: orgId,
          taxProfileId: taxProfileId || null,
          taxOverrides: taxOverrides || undefined
        });

        taxCalculationMethod = taxOverrides ? 'override' : 'profile';
      } catch (error) {
        console.error('Error calculating tax:', error);
        // Continue with manual tax calculation if custom tax fails
      }
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
        const invoice = await tx.invoice.create({
          data: {
            invoiceNo: counter.lastInvoiceNo,
            customerId,
            organizationId: orgId,
            dueDate: new Date(dueDate),
            issueDate: issueDate ? new Date(issueDate) : new Date(),
            status: status || 'draft',
            notes,
            currency: finalCurrency,
            ...(finalTemplateId && { templateId: finalTemplateId }),
            // Custom Tax System fields
            taxCalculationMethod: taxCalculationMethod,
            ...(taxProfileId && { taxProfileId }),
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

        // Save invoice taxes if custom tax was calculated
        if (taxCalculationResult && taxCalculationResult.taxes.length > 0) {
          await saveInvoiceTaxes(
            invoice.id,
            taxCalculationResult.taxes.map((tax) => ({
              ...tax,
              isOverride: taxCalculationMethod === 'override'
            })),
            tx // Pass transaction client
          );
        }

        return invoice;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        maxWait: 5000,
        timeout: 10000
      }
    );

    // Reload invoice with taxes to include invoiceTaxes in response
    const invoiceWithTaxes = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true,
        invoiceTaxes: true,
        taxProfile: {
          include: {
            taxRules: true
          }
        }
      }
    });

    return NextResponse.json(invoiceWithTaxes, { status: 201 });
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
