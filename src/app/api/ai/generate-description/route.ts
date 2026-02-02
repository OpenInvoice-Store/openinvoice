import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateInvoiceDescription } from '@/lib/ai';

/**
 * POST - Generate invoice item description using AI
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
    const { productName, customerId, customerName, previousDescriptions } =
      body;

    if (!productName) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    const description = await generateInvoiceDescription(orgId, productName, {
      customerName,
      previousDescriptions
    });

    return NextResponse.json({ description });
  } catch (error: any) {
    console.error('Error generating description:', error);
    return NextResponse.json(
      {
        error:
          error.message ||
          'Failed to generate description. Please check your AI configuration.'
      },
      { status: 500 }
    );
  }
}
