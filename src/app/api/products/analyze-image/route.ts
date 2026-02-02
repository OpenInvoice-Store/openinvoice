import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { analyzeProductImage } from '@/lib/ai';

/**
 * POST - Analyze product image and extract details using AI
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
    const { imageUrl } = body;

    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json(
        { error: 'Image URL is required' },
        { status: 400 }
      );
    }

    // Analyze the image using AI
    const analysis = await analyzeProductImage(orgId, imageUrl);

    return NextResponse.json(analysis, { status: 200 });
  } catch (error: any) {
    console.error('Error analyzing product image:', error);

    // Check if it's an AI configuration error
    if (
      error.message?.includes('not configured') ||
      error.message?.includes('not enabled')
    ) {
      return NextResponse.json(
        {
          error:
            'AI is not configured or enabled. Please configure AI settings first.'
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to analyze product image',
        details: error.message || 'Unknown error'
      },
      { status: 500 }
    );
  }
}
