import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import React from 'react';
import { InvoicePDF } from '@/features/invoicing/components/invoice-pdf';
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
    const invoice = await prisma.invoice.findFirst({
      where: { id, organizationId: orgId },
      include: {
        customer: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true,
        organization: {
          select: {
            id: true,
            name: true,
            logoUrl: true,
            primaryColor: true,
            secondaryColor: true,
            fontFamily: true,
            companyAddress: true,
            companyPhone: true,
            companyEmail: true,
            companyWebsite: true,
            footerText: true,
            defaultCurrency: true
          }
        },
        invoiceTemplate: true,
        invoiceTaxes: true
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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
    const totalTax = manualTax + customTax;
    const total = subtotal + totalTax;
    const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = total - totalPaid;

    const pdfElement = (
      <InvoicePDF
        invoice={{
          ...invoice,
          subtotal,
          manualTax,
          customTax,
          invoiceTaxes: (invoice as any).invoiceTaxes || [],
          tax: totalTax,
          total,
          totalPaid,
          balance,
          taxCalculationMethod: (invoice as any).taxCalculationMethod
        }}
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
        'Content-Disposition': `attachment; filename="invoice-${invoice.invoiceNo}.pdf"`
      }
    });
  } catch (error) {
    console.error('Error generating PDF:', error);
    return NextResponse.json(
      { error: 'Failed to generate PDF' },
      { status: 500 }
    );
  }
}
