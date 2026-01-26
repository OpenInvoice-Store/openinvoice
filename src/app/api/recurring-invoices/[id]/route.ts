import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET - Get a specific recurring invoice template
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

    const template = await prisma.recurringInvoiceTemplate.findFirst({
      where: { id, organizationId: orgId },
      include: {
        customer: true,
        organization: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          include: {
            items: {
              include: {
                product: true
              }
            },
            payments: true
          }
        }
      }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Recurring invoice template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching recurring invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recurring invoice template' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a recurring invoice template
 */
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
    const body = await request.json();

    // Verify template belongs to organization
    const existingTemplate = await prisma.recurringInvoiceTemplate.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Recurring invoice template not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.frequency !== undefined) {
      const validFrequencies = [
        'daily',
        'weekly',
        'biweekly',
        'monthly',
        'quarterly',
        'yearly',
        'custom'
      ];
      if (!validFrequencies.includes(body.frequency)) {
        return NextResponse.json(
          {
            error: `Invalid frequency. Must be one of: ${validFrequencies.join(', ')}`
          },
          { status: 400 }
        );
      }
      updateData.frequency = body.frequency;
    }
    if (body.interval !== undefined) updateData.interval = body.interval;
    if (body.startDate !== undefined)
      updateData.startDate = new Date(body.startDate);
    if (body.endDate !== undefined)
      updateData.endDate = body.endDate ? new Date(body.endDate) : null;
    if (body.nextGenerationDate !== undefined)
      updateData.nextGenerationDate = new Date(body.nextGenerationDate);
    if (body.templateItems !== undefined) {
      // Validate items
      let itemsArray;
      try {
        itemsArray =
          typeof body.templateItems === 'string'
            ? JSON.parse(body.templateItems)
            : body.templateItems;
        if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
          throw new Error('Items must be a non-empty array');
        }
        updateData.templateItems = JSON.stringify(itemsArray);
      } catch (error) {
        return NextResponse.json(
          {
            error: 'Invalid template items format. Must be a valid JSON array.'
          },
          { status: 400 }
        );
      }
    }
    if (body.templateNotes !== undefined)
      updateData.templateNotes = body.templateNotes;
    if (body.daysUntilDue !== undefined)
      updateData.daysUntilDue = body.daysUntilDue;
    if (body.status !== undefined) {
      const validStatuses = ['active', 'paused', 'cancelled', 'completed'];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          {
            error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
          },
          { status: 400 }
        );
      }
      updateData.status = body.status;
    }
    if (body.autoSendEmail !== undefined)
      updateData.autoSendEmail = body.autoSendEmail;
    if (body.isUsageBased !== undefined)
      updateData.isUsageBased = body.isUsageBased;
    if (body.usageUnit !== undefined) updateData.usageUnit = body.usageUnit;

    const updatedTemplate = await prisma.recurringInvoiceTemplate.update({
      where: { id },
      data: updateData,
      include: {
        customer: true,
        organization: true
      }
    });

    return NextResponse.json(updatedTemplate);
  } catch (error) {
    console.error('Error updating recurring invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to update recurring invoice template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a recurring invoice template
 */
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

    // Delete the template (cascade will handle related invoices)
    await prisma.recurringInvoiceTemplate.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Recurring invoice template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting recurring invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to delete recurring invoice template' },
      { status: 500 }
    );
  }
}
