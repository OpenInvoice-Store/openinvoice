import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { auth } from '@clerk/nextjs/server';

export async function POST(
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
    
    // Check if invoice exists and belongs to the organization
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Generate a share token if it doesn't exist
    let shareToken = invoice.shareToken;
    
    if (!shareToken) {
      // Generate a secure random token
      shareToken = randomBytes(32).toString('base64url');
      
      // Update invoice with share token
      await prisma.invoice.update({
        where: { id },
        data: { shareToken },
      });
    }

    const baseUrl = request.nextUrl.origin;
    const shareUrl = `${baseUrl}/invoice/${shareToken}`;

    return NextResponse.json({ shareUrl, shareToken });
  } catch (error) {
    console.error('Error generating share token:', error);
    return NextResponse.json(
      { error: 'Failed to generate share token' },
      { status: 500 }
    );
  }
}

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
    
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      select: { shareToken: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    if (!invoice.shareToken) {
      return NextResponse.json({ shareUrl: null, shareToken: null });
    }

    const baseUrl = request.nextUrl.origin;
    const shareUrl = `${baseUrl}/invoice/${invoice.shareToken}`;

    return NextResponse.json({ shareUrl, shareToken: invoice.shareToken });
  } catch (error) {
    console.error('Error fetching share token:', error);
    return NextResponse.json(
      { error: 'Failed to fetch share token' },
      { status: 500 }
    );
  }
}

