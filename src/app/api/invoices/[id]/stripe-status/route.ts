import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        organization: true
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Return Stripe connection status (public endpoint, no auth required)
    return NextResponse.json({
      connected: invoice.organization.stripeConnectEnabled,
      status: invoice.organization.stripeAccountStatus
    });
  } catch (error) {
    console.error('Error fetching Stripe status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Stripe status' },
      { status: 500 }
    );
  }
}
