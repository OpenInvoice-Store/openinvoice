import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { sendInvoiceEmail } from '@/lib/email';
import { randomBytes } from 'crypto';
import { getInvoiceCurrency } from '@/lib/currency';

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
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            companyAddress: true,
            companyPhone: true,
            companyEmail: true,
            companyWebsite: true,
            footerText: true,
            defaultCurrency: true
          }
        },
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
    // Custom tax from invoice taxes (tax profile)
    const customTax =
      (invoice as any).invoiceTaxes?.reduce(
        (sum: number, tax: any) => sum + tax.amount,
        0
      ) || 0;
    const total = subtotal + manualTax + customTax;

    // Build URLs
    const baseUrl = request.nextUrl.origin;
    const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;
    const pdfUrl = `${baseUrl}/api/invoices/${id}/pdf`;

    // Get branding data
    const branding = {
      logoUrl: invoice.organization.logoUrl,
      primaryColor: invoice.organization.primaryColor,
      secondaryColor: invoice.organization.secondaryColor,
      companyAddress: invoice.organization.companyAddress,
      companyPhone: invoice.organization.companyPhone,
      companyEmail: invoice.organization.companyEmail,
      companyWebsite: invoice.organization.companyWebsite,
      footerText: invoice.organization.footerText
    };

    // Send email and track it
    let emailResult;
    let emailStatus = 'sent';
    let errorMessage: string | null = null;
    let resendId: string | null = null;

    try {
      // Prepare tax breakdown for email
      const invoiceTaxes = (invoice as any).invoiceTaxes || [];

      emailResult = await sendInvoiceEmail({
        to: invoice.customer.email,
        customerName: invoice.customer.name,
        invoiceNo: invoice.invoiceNo,
        invoiceUrl,
        pdfUrl,
        issueDate: invoice.issueDate,
        dueDate: invoice.dueDate,
        total,
        subtotal,
        manualTax,
        invoiceTaxes: invoiceTaxes.map((tax: any) => ({
          name: tax.name,
          rate: tax.rate,
          amount: tax.amount,
          authority: tax.authority || undefined
        })),
        currency: getInvoiceCurrency(
          invoice as {
            currency?: string | null;
            organization?: { defaultCurrency?: string };
          }
        ),
        organizationName: invoice.organization?.name,
        organizationId: orgId,
        branding: branding
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
