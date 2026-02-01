import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import React from 'react';
import { renderToStream } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import { PaymentReceiptPDF } from '@/features/invoicing/components/payment-receipt-pdf';

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

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: {
          include: {
            customer: true,
            items: true,
            payments: true,
            organization: true
          }
        }
      }
    });

    if (!payment || payment.invoice.organizationId !== orgId) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Optionally enrich with card details from Stripe charge
    let cardBrand: string | null = null;
    let cardLast4: string | null = null;

    if (payment.stripeChargeId) {
      try {
        const charge = await stripe.charges.retrieve(payment.stripeChargeId);
        const card = (charge.payment_method_details as any)?.card;
        if (card) {
          cardBrand = card.brand || null;
          cardLast4 = card.last4 || null;
        }
      } catch (error) {
        // If we can't retrieve card details, just skip them
        console.error('Error retrieving Stripe charge for receipt:', error);
      }
    }

    const pdfElement = (
      <PaymentReceiptPDF
        payment={payment}
        invoice={payment.invoice}
        organizationName={payment.invoice.organization?.name}
        cardBrand={cardBrand}
        cardLast4={cardLast4}
      />
    ) as React.ReactElement<DocumentProps>;

    const pdfStream = await renderToStream(pdfElement);

    const chunks: Buffer[] = [];
    for await (const chunk of pdfStream) {
      chunks.push(Buffer.from(chunk));
    }
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="receipt-invoice-${payment.invoice.invoiceNo}-payment-${payment.id}.pdf"`
      }
    });
  } catch (error) {
    console.error('Error generating payment receipt PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate payment receipt PDF' },
      { status: 500 }
    );
  }
}
