import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserAndOrganization } from '@/lib/clerk-sync';
import { Prisma } from '@prisma/client';

/**
 * GET - List all recurring invoice templates for the organization
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

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    const templates = await prisma.recurringInvoiceTemplate.findMany({
      where: {
        organizationId: orgId,
        ...(status && { status }),
        ...(customerId && { customerId })
      },
      include: {
        customer: true,
        organization: true,
        invoices: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNo: true,
            status: true,
            issueDate: true,
            dueDate: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            invoices: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching recurring invoice templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recurring invoice templates' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new recurring invoice template
 */
export async function POST(request: NextRequest) {
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
      name,
      customerId,
      frequency,
      interval = 1,
      startDate,
      endDate,
      templateItems,
      templateNotes,
      daysUntilDue = 30,
      autoSendEmail = true,
      isUsageBased = false,
      usageUnit
    } = body;

    // Validation
    if (!name || !customerId || !frequency || !startDate || !templateItems) {
      return NextResponse.json(
        {
          error: 'Name, customer, frequency, start date, and items are required'
        },
        { status: 400 }
      );
    }

    // Validate frequency
    const validFrequencies = [
      'daily',
      'weekly',
      'biweekly',
      'monthly',
      'quarterly',
      'yearly',
      'custom'
    ];
    if (!validFrequencies.includes(frequency)) {
      return NextResponse.json(
        {
          error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`
        },
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

    // Validate template items
    let itemsArray;
    try {
      itemsArray =
        typeof templateItems === 'string'
          ? JSON.parse(templateItems)
          : templateItems;
      if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
        throw new Error('Items must be a non-empty array');
      }
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid template items format. Must be a valid JSON array.' },
        { status: 400 }
      );
    }

    // Calculate next generation date (start date)
    const nextGenDate = new Date(startDate);
    const endDateObj = endDate ? new Date(endDate) : null;

    // Create the template
    const template = await prisma.recurringInvoiceTemplate.create({
      data: {
        name,
        organizationId: orgId,
        customerId,
        frequency,
        interval,
        startDate: new Date(startDate),
        endDate: endDateObj,
        nextGenerationDate: nextGenDate,
        templateItems: JSON.stringify(itemsArray),
        templateNotes,
        daysUntilDue,
        status: 'active',
        autoSendEmail,
        isUsageBased,
        usageUnit,
        totalGenerated: 0
      },
      include: {
        customer: true,
        organization: true
      }
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating recurring invoice template:', error);

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A template with this name already exists' },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to create recurring invoice template'
      },
      { status: 500 }
    );
  }
}
