import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sendPaymentConfirmationEmail } from '@/lib/email';
import {
  applyPaymentToInstallments,
  updateInvoiceStatusFromPaymentPlan
} from '@/lib/payment-plan';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const invoiceId = searchParams.get('invoiceId');
    const customerId = searchParams.get('customerId');

    const payments = await prisma.payment.findMany({
      where: {
        ...(invoiceId && { invoiceId }),
        ...(customerId && {
          invoice: {
            customerId
          }
        }),
        invoice: {
          organizationId: orgId
        }
      },
      include: {
        invoice: {
          include: {
            customer: true,
            organization: {
              select: {
                defaultCurrency: true
              }
            }
          }
        }
      },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

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
    const { invoiceId, amount, date, method, notes } = body;

    if (!invoiceId || !amount || !method) {
      return NextResponse.json(
        { error: 'Invoice ID, amount, and method are required' },
        { status: 400 }
      );
    }

    // Verify invoice belongs to the organization
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, organizationId: orgId },
      include: {
        items: true,
        payments: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    const paymentAmount = parseFloat(amount);
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount: paymentAmount,
        date: date ? new Date(date) : new Date(),
        method,
        notes
      },
      include: {
        invoice: {
          include: {
            customer: true,
            organization: true,
            items: true,
            payments: true,
            paymentPlan: true
          }
        }
      }
    });

    // If invoice has a payment plan, apply payment to installments
    if (payment.invoice.paymentPlan) {
      await applyPaymentToInstallments(invoiceId, payment.id, paymentAmount);
    }

    // Update invoice status (handles both regular and payment plan invoices)
    await updateInvoiceStatusFromPaymentPlan(invoiceId);

    // Send payment confirmation email if customer has email
    if (payment.invoice.customer.email) {
      try {
        // Generate share token if it doesn't exist
        let shareToken = payment.invoice.shareToken;
        if (!shareToken) {
          const { randomBytes } = await import('crypto');
          shareToken = randomBytes(32).toString('base64url');
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: { shareToken }
          });
        }

        const baseUrl = request.nextUrl.origin;
        const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;

        let emailResult;
        let emailStatus = 'sent';
        let errorMessage: string | null = null;
        let resendId: string | null = null;

        try {
          emailResult = await sendPaymentConfirmationEmail({
            to: payment.invoice.customer.email,
            customerName: payment.invoice.customer.name,
            invoiceNo: payment.invoice.invoiceNo,
            invoiceUrl,
            amount: payment.amount,
            paymentDate: payment.date,
            organizationName: payment.invoice.organization?.name,
            organizationId: orgId
          });
          resendId = emailResult.id || null;
        } catch (emailError) {
          emailStatus = 'failed';
          errorMessage =
            emailError instanceof Error ? emailError.message : 'Unknown error';
          throw emailError;
        }

        // Log the payment confirmation email
        await prisma.emailLog.create({
          data: {
            invoiceId,
            emailType: 'payment_confirmation',
            recipient: payment.invoice.customer.email,
            status: emailStatus,
            resendId,
            errorMessage
          }
        });
      } catch (emailError) {
        // Log error but don't fail the payment creation
        console.error('Error sending payment confirmation email:', emailError);
      }
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
