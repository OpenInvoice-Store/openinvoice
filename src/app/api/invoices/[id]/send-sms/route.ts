import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  sendSMS,
  generateInvoiceSMS,
  formatPhoneNumber,
  isValidPhoneNumber
} from '@/lib/sms';
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

    // Check if customer has a phone number
    if (!invoice.customer.phone) {
      return NextResponse.json(
        { error: 'Customer does not have a phone number' },
        { status: 400 }
      );
    }

    // Format and validate phone number
    const formattedPhone = formatPhoneNumber(invoice.customer.phone);
    if (!isValidPhoneNumber(formattedPhone)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
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
    const manualTax = invoice.items.reduce(
      (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
      0
    );
    const customTax =
      (invoice as any).invoiceTaxes?.reduce(
        (sum: number, tax: any) => sum + tax.amount,
        0
      ) || 0;
    const total = subtotal + manualTax + customTax;

    // Build invoice URL
    const baseUrl = request.nextUrl.origin;
    const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;

    // Send SMS and track it
    let smsResult;
    let smsStatus = 'sent';
    let errorMessage: string | null = null;
    let twilioSid: string | null = null;

    try {
      const currency = getInvoiceCurrency(
        invoice as {
          currency?: string | null;
          organization?: { defaultCurrency?: string };
        }
      );

      const smsMessage = generateInvoiceSMS({
        customerName: invoice.customer.name,
        invoiceNo: invoice.invoiceNo,
        total,
        invoiceUrl,
        currency,
        organizationName: invoice.organization?.name
      });

      smsResult = await sendSMS({
        to: formattedPhone,
        message: smsMessage,
        invoiceId: id,
        smsType: 'invoice',
        organizationId: orgId
      });

      twilioSid = smsResult.twilioSid;
      if (!smsResult.success) {
        smsStatus = 'failed';
        errorMessage = smsResult.error || 'Failed to send SMS';
      }
    } catch (smsError) {
      smsStatus = 'failed';
      errorMessage =
        smsError instanceof Error ? smsError.message : 'Unknown error';
    }

    // Always log the SMS attempt (success or failure)
    await prisma.smsLog.create({
      data: {
        invoiceId: id,
        smsType: 'invoice',
        recipient: formattedPhone,
        message: smsResult
          ? generateInvoiceSMS({
              customerName: invoice.customer.name,
              invoiceNo: invoice.invoiceNo,
              total,
              invoiceUrl,
              currency: getInvoiceCurrency(invoice as any),
              organizationName: invoice.organization?.name
            })
          : 'Failed to generate message',
        status: smsStatus,
        twilioSid,
        errorMessage
      }
    });

    // Only increment count and update status if SMS was sent successfully
    if (smsStatus === 'sent') {
      const updateData: {
        status?: string;
      } = {};

      if (invoice.status === 'draft') {
        updateData.status = 'sent';
      }

      await prisma.invoice.update({
        where: { id },
        data: updateData
      });

      return NextResponse.json({
        success: true,
        message: 'Invoice SMS sent successfully',
        twilioSid: twilioSid
      });
    } else {
      // SMS failed but was logged
      return NextResponse.json(
        {
          success: false,
          error: errorMessage || 'Failed to send invoice SMS',
          message: 'SMS sending failed but attempt was logged'
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error sending invoice SMS:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to send invoice SMS'
      },
      { status: 500 }
    );
  }
}
