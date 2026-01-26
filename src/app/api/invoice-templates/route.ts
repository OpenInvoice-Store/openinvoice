import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET - List all invoice templates for the organization
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

    const templates = await prisma.invoiceTemplate.findMany({
      where: {
        organizationId: orgId,
        isActive: true
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }]
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Error fetching invoice templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice templates' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new invoice template
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
      layout = 'standard',
      headerTemplate,
      footerTemplate,
      styles,
      isDefault = false
    } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: {
          organizationId: orgId,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });
    }

    const template = await prisma.invoiceTemplate.create({
      data: {
        name: name.trim(),
        organizationId: orgId,
        layout,
        headerTemplate: headerTemplate || null,
        footerTemplate: footerTemplate || null,
        styles: styles ? JSON.stringify(styles) : null,
        isDefault,
        isActive: true
      }
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Error creating invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice template' },
      { status: 500 }
    );
  }
}
