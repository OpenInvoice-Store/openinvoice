import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sendInvoiceEmail } from '@/lib/email';
import { randomBytes } from 'crypto';

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

    // Fetch invoice with all related data
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: {
        customer: true,
        organization: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Check if customer has an email
    if (!invoice.customer.email) {
      return NextResponse.json(
        { error: 'Customer does not have an email address' },
        { status: 400 }
      );
    }

    // Generate share token if it doesn't exist
    let shareToken = invoice.shareToken;

    if (!shareToken) {
      shareToken = randomBytes(32).toString('base64url');
      await prisma.invoice.update({
        where: { id },
        data: { shareToken }
      });
    }

    // Calculate totals
    const subtotal = invoice.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = invoice.items.reduce(
      (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
      0
    );
    const total = subtotal + tax;

    // Build URLs
    const baseUrl = request.nextUrl.origin;
    const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;
    const pdfUrl = `${baseUrl}/api/invoices/${id}/pdf`;

    // Send email and track it
    let emailResult;
    let emailStatus = 'sent';
    let errorMessage: string | null = null;
    let resendId: string | null = null;

    try {
      emailResult = await sendInvoiceEmail({
        to: invoice.customer.email,
        customerName: invoice.customer.name,
        invoiceNo: invoice.invoiceNo,
        invoiceUrl,
        pdfUrl,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total,
        organizationName: invoice.organization?.name
      });
      resendId = emailResult.id || null;
    } catch (emailError) {
      emailStatus = 'failed';
      errorMessage =
        emailError instanceof Error ? emailError.message : 'Unknown error';
    }

    // Always log the email attempt (success or failure)
    await prisma.emailLog.create({
      data: {
        invoiceId: id,
        emailType: 'invoice',
        recipient: invoice.customer.email,
        status: emailStatus,
        resendId,
        errorMessage
      }
    });

    // Only increment count and update status if email was sent successfully
    if (emailStatus === 'sent') {
      const updateData: {
        status?: string;
        emailSentCount: { increment: number };
      } = {
        emailSentCount: { increment: 1 }
      };

      if (invoice.status === 'draft') {
        updateData.status = 'sent';
      }

      await prisma.invoice.update({
        where: { id },
        data: updateData
      });

      return NextResponse.json({
        success: true,
        message: 'Invoice email sent successfully',
        emailId: resendId
      });
    } else {
      // Email failed but was logged
      return NextResponse.json(
        {
          success: false,
          error: errorMessage || 'Failed to send invoice email',
          message: 'Email sending failed but attempt was logged'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to send invoice email'
      },
      { status: 500 }
    );
  }
}
