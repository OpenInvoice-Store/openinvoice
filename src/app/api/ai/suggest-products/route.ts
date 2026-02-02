import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { suggestProducts } from '@/lib/ai';

/**
 * GET - Get smart product suggestions for a customer
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

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const limit = parseInt(searchParams.get('limit') || '5');

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const suggestions = await suggestProducts(orgId, customerId, limit);

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Error getting product suggestions:', error);
    return NextResponse.json(
      {
        error:
          error.message ||
          'Failed to get product suggestions. Please check your AI configuration.'
      },
      { status: 500 }
    );
  }
}
