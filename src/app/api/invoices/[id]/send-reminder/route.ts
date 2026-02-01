import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sendPaymentReminderEmail } from '@/lib/email';
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
        payments: true,
        invoiceTaxes: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    // Check if invoice is already paid
    if (invoice.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot send reminder for a paid invoice' },
        { status: 400 }
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
    // Manual tax from item taxRate
    const manualTax = invoice.items.reduce(
      (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
      0
    );
    // Custom tax from invoice taxes
    const customTax =
      (invoice as any).invoiceTaxes?.reduce(
        (sum: number, tax: any) => sum + tax.amount,
        0
      ) || 0;
    const total = subtotal + manualTax + customTax;
    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = total - totalPaid;

    // Calculate days until due or days overdue
    const now = new Date();
    const dueDate = new Date(invoice.dueDate);
    const daysDiff = Math.ceil(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysUntilDue = daysDiff > 0 ? daysDiff : undefined;
    const daysOverdue = daysDiff < 0 ? Math.abs(daysDiff) : undefined;

    // Determine reminder type
    let reminderType: 'upcoming' | 'overdue' | 'final' = 'upcoming';
    if (daysOverdue) {
      if (daysOverdue >= 30) {
        reminderType = 'final';
      } else {
        reminderType = 'overdue';
      }
    }

    // Build URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;
    const pdfUrl = `${baseUrl}/api/invoices/${id}/pdf`;

    // Send reminder email
    let emailResult;
    let emailStatus = 'sent';
    let errorMessage: string | null = null;
    let resendId: string | null = null;

    try {
      emailResult = await sendPaymentReminderEmail({
        to: invoice.customer.email,
        customerName: invoice.customer.name,
        invoiceNo: invoice.invoiceNo,
        invoiceUrl,
        pdfUrl,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total: remainingBalance > 0 ? remainingBalance : total,
        daysUntilDue,
        daysOverdue,
        organizationName: invoice.organization?.name,
        organizationId: orgId,
        reminderType
      });
      resendId = emailResult.id || null;
    } catch (emailError) {
      emailStatus = 'failed';
      errorMessage =
        emailError instanceof Error ? emailError.message : 'Unknown error';
    }

    // Log the email attempt
    await prisma.emailLog.create({
      data: {
        invoiceId: id,
        emailType: 'payment_reminder',
        recipient: invoice.customer.email,
        status: emailStatus,
        resendId,
        errorMessage
      }
    });

    // Update invoice reminder tracking
    if (emailStatus === 'sent') {
      await prisma.invoice.update({
        where: { id },
        data: {
          lastReminderSentAt: new Date(),
          reminderCount: { increment: 1 },
          // Mark as overdue if past due date and not already overdue
          ...(daysOverdue &&
            invoice.status !== 'overdue' && {
              status: 'overdue',
              markedOverdueAt: invoice.markedOverdueAt || new Date()
            })
        }
      });

      return NextResponse.json({
        success: true,
        message: 'Payment reminder sent successfully',
        emailId: resendId,
        reminderType,
        daysOverdue,
        daysUntilDue
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: errorMessage || 'Failed to send payment reminder',
          message: 'Reminder sending failed but attempt was logged'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    return NextResponse.json(
      { error: 'Failed to send payment reminder' },
      { status: 500 }
    );
  }
}
