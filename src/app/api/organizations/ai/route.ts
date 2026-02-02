import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * GET - Get AI settings for the organization
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

    const organization = (await prisma.organization.findUnique({
      where: { id: orgId }
    })) as unknown as {
      id: string;
      aiProvider: string | null;
      aiEnabled: boolean;
      openaiApiKey: string | null;
      geminiApiKey: string | null;
    } | null;

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Return settings without exposing actual API keys
    return NextResponse.json({
      aiProvider: organization.aiProvider || null,
      aiEnabled: organization.aiEnabled || false,
      hasOpenAIKey: !!organization.openaiApiKey,
      hasGeminiKey: !!organization.geminiApiKey
    });
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update AI settings for the organization
 */
export async function PUT(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { aiProvider, openaiApiKey, geminiApiKey, aiEnabled } = body;

    // Validate provider if provided
    if (aiProvider && !['openai', 'gemini'].includes(aiProvider)) {
      return NextResponse.json(
        { error: 'Invalid AI provider. Must be "openai" or "gemini"' },
        { status: 400 }
      );
    }

    // If enabling AI, ensure provider and API key are set
    if (aiEnabled === true) {
      if (!aiProvider) {
        return NextResponse.json(
          { error: 'AI provider is required when enabling AI features' },
          { status: 400 }
        );
      }

      const requiredApiKey =
        aiProvider === 'openai' ? openaiApiKey : geminiApiKey;
      if (!requiredApiKey) {
        return NextResponse.json(
          {
            error: `${aiProvider === 'openai' ? 'OpenAI' : 'Gemini'} API key is required when enabling AI features`
          },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (aiProvider !== undefined) updateData.aiProvider = aiProvider || null;
    if (openaiApiKey !== undefined)
      updateData.openaiApiKey = openaiApiKey || null;
    if (geminiApiKey !== undefined)
      updateData.geminiApiKey = geminiApiKey || null;
    if (aiEnabled !== undefined) updateData.aiEnabled = aiEnabled;

    const updated = (await prisma.organization.update({
      where: { id: orgId },
      data: updateData
    })) as unknown as {
      id: string;
      aiProvider: string | null;
      aiEnabled: boolean;
    };

    // Return only the fields we want
    return NextResponse.json({
      id: updated.id,
      aiProvider: updated.aiProvider || null,
      aiEnabled: updated.aiEnabled || false
    });
  } catch (error) {
    console.error('Error updating AI settings:', error);
    return NextResponse.json(
      { error: 'Failed to update AI settings' },
      { status: 500 }
    );
  }
}
