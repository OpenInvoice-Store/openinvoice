import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET - Get a specific invoice template
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

    const template = await prisma.invoiceTemplate.findFirst({
      where: {
        id,
        organizationId: orgId
      }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Invoice template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error('Error fetching invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice template' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update an invoice template
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
    const existingTemplate = await prisma.invoiceTemplate.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Invoice template not found' },
        { status: 404 }
      );
    }

    const updateData: any = {};

    if (body.name !== undefined) {
      if (!body.name || body.name.trim() === '') {
        return NextResponse.json(
          { error: 'Template name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.name = body.name.trim();
    }

    if (body.layout !== undefined) updateData.layout = body.layout;
    if (body.headerTemplate !== undefined)
      updateData.headerTemplate = body.headerTemplate || null;
    if (body.footerTemplate !== undefined)
      updateData.footerTemplate = body.footerTemplate || null;
    if (body.styles !== undefined)
      updateData.styles = body.styles ? JSON.stringify(body.styles) : null;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;

    // Handle default template change
    if (
      body.isDefault !== undefined &&
      body.isDefault !== existingTemplate.isDefault
    ) {
      if (body.isDefault) {
        // Unset other defaults
        await prisma.invoiceTemplate.updateMany({
          where: {
            organizationId: orgId,
            isDefault: true,
            id: { not: id }
          },
          data: {
            isDefault: false
          }
        });
      }
      updateData.isDefault = body.isDefault;
    }

    const updated = await prisma.invoiceTemplate.update({
      where: { id },
      data: updateData
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete an invoice template
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
    const template = await prisma.invoiceTemplate.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!template) {
      return NextResponse.json(
        { error: 'Invoice template not found' },
        { status: 404 }
      );
    }

    // Don't allow deleting the default template
    if (template.isDefault) {
      return NextResponse.json(
        {
          error:
            'Cannot delete the default template. Set another template as default first.'
        },
        { status: 400 }
      );
    }

    // Soft delete by setting isActive to false
    await prisma.invoiceTemplate.update({
      where: { id },
      data: { isActive: false }
    });

    return NextResponse.json({
      message: 'Invoice template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to delete invoice template' },
      { status: 500 }
    );
  }
}
