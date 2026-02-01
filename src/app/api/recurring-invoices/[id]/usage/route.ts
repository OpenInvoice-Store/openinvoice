import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET - Get usage records for a recurring invoice template
 */
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
    const searchParams = request.nextUrl.searchParams;
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    // Verify template belongs to organization
    const template = await prisma.recurringInvoiceTemplate.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Recurring invoice template not found' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = {
      recurringTemplateId: id
    };

    if (periodStart && periodEnd) {
      where.periodStart = { gte: new Date(periodStart) };
      where.periodEnd = { lte: new Date(periodEnd) };
    }

    const usageRecords = await prisma.usageRecord.findMany({
      where,
      orderBy: { recordedAt: 'desc' },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            issueDate: true,
            dueDate: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json(usageRecords);
  } catch (error) {
    console.error('Error fetching usage records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage records' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new usage record
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId, userId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { periodStart, periodEnd, quantity, metadata } = body;

    // Validation
    if (!periodStart || !periodEnd || quantity === undefined) {
      return NextResponse.json(
        {
          error: 'periodStart, periodEnd, and quantity are required'
        },
        { status: 400 }
      );
    }

    if (quantity < 0) {
      return NextResponse.json(
        { error: 'Quantity must be non-negative' },
        { status: 400 }
      );
    }

    // Verify template belongs to organization
    const template = await prisma.recurringInvoiceTemplate.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Recurring invoice template not found' },
        { status: 404 }
      );
    }

    // Create usage record
    const usageRecord = await prisma.usageRecord.create({
      data: {
        recurringTemplateId: id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        quantity: parseFloat(quantity),
        metadata: metadata ? JSON.stringify(metadata) : null,
        recordedBy: userId || null
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNo: true,
            issueDate: true,
            dueDate: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json(usageRecord, { status: 201 });
  } catch (error) {
    console.error('Error creating usage record:', error);
    return NextResponse.json(
      { error: 'Failed to create usage record' },
      { status: 500 }
    );
  }
}
