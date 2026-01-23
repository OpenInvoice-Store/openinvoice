import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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

    // Verify invoice belongs to the organization
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      select: { id: true }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Fetch email logs with events for this invoice
    const emailLogs = await prisma.emailLog.findMany({
      where: { invoiceId: id },
      include: {
        events: {
          orderBy: { occurredAt: 'desc' }
        }
      },
      orderBy: { sentAt: 'desc' }
    });

    return NextResponse.json(emailLogs);
  } catch (error) {
    console.error('Error fetching email logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email logs' },
      { status: 500 }
    );
  }
}
