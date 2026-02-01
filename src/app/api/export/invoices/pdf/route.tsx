import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { renderToStream } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import React from 'react';
import { InvoicePDF } from '@/features/invoicing/components/invoice-pdf';
import JSZip from 'jszip';

/**
 * POST - Export multiple invoices as PDFs in a ZIP file
 * Body: { invoiceIds: string[] } or query params: status, customerId
 */
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { invoiceIds } = body;

    // Build query
    const where: any = {
      organizationId: orgId
    };

    if (invoiceIds && Array.isArray(invoiceIds) && invoiceIds.length > 0) {
      where.id = { in: invoiceIds };
    } else {
      // If no specific IDs, get all invoices (or apply filters from query params)
      const searchParams = request.nextUrl.searchParams;
      const status = searchParams.get('status');
      const customerId = searchParams.get('customerId');

      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
    }

    // Fetch invoices
    const invoices = await prisma.invoice.findMany({
      where,
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
          } as any
        },
        invoiceTemplate: true,
        invoiceTaxes: true
      } as any,
      orderBy: { invoiceNo: 'asc' }
    });

    if (invoices.length === 0) {
      return NextResponse.json(
        { error: 'No invoices found to export' },
        { status: 404 }
      );
    }

    // Limit to prevent memory issues
    if (invoices.length > 100) {
      return NextResponse.json(
        { error: 'Too many invoices. Please export 100 or fewer at a time.' },
        { status: 400 }
      );
    }

    // Create ZIP file
    const zip = new JSZip();

    // Generate PDF for each invoice
    for (const invoice of invoices) {
      // Calculate totals
      const invoiceWithRelations = invoice as any;
      const subtotal = invoiceWithRelations.items.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0
      );
      // Manual tax from item taxRate
      const manualTax = invoiceWithRelations.items.reduce(
        (sum: number, item: any) =>
          sum + item.price * item.quantity * (item.taxRate / 100),
        0
      );
      // Custom tax from invoice taxes
      const customTax =
        invoiceWithRelations.invoiceTaxes?.reduce(
          (sum: number, tax: any) => sum + tax.amount,
          0
        ) || 0;
      const totalTax = manualTax + customTax;
      const total = subtotal + totalTax;
      const totalPaid = invoiceWithRelations.payments.reduce(
        (sum: number, p: any) => sum + p.amount,
        0
      );
      const balance = total - totalPaid;

      // Generate PDF
      const pdfElement = (
        <InvoicePDF
          invoice={{
            ...invoiceWithRelations,
            subtotal,
            manualTax,
            customTax,
            invoiceTaxes: invoiceWithRelations.invoiceTaxes || [],
            tax: totalTax,
            total,
            totalPaid,
            balance,
            taxCalculationMethod: invoiceWithRelations.taxCalculationMethod
          }}
        />
      ) as React.ReactElement<DocumentProps>;

      const pdfStream = await renderToStream(pdfElement);

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of pdfStream) {
        chunks.push(Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);

      // Add to ZIP with filename
      const filename = `invoice-${invoice.invoiceNo}.pdf`;
      zip.file(filename, pdfBuffer);
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const timestamp = new Date().toISOString().split('T')[0];
    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="invoices-${timestamp}.zip"`
      }
    });
  } catch (error) {
    console.error('Error exporting invoices as PDF:', error);
    return NextResponse.json(
      { error: 'Failed to export invoices as PDF' },
      { status: 500 }
    );
  }
}

/**
 * GET - Export invoices as PDFs in a ZIP file (using query params)
 */
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
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const invoiceIds = searchParams.get('invoiceIds');

    // Build query
    const where: any = {
      organizationId: orgId
    };

    if (invoiceIds) {
      const ids = invoiceIds.split(',').filter(Boolean);
      if (ids.length > 0) {
        where.id = { in: ids };
      }
    } else {
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
    }

    // Fetch invoices
    const invoices = await prisma.invoice.findMany({
      where,
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
          } as any
        },
        invoiceTemplate: true,
        invoiceTaxes: true
      } as any,
      orderBy: { invoiceNo: 'asc' }
    });

    if (invoices.length === 0) {
      return NextResponse.json(
        { error: 'No invoices found to export' },
        { status: 404 }
      );
    }

    // Limit to prevent memory issues
    if (invoices.length > 100) {
      return NextResponse.json(
        { error: 'Too many invoices. Please export 100 or fewer at a time.' },
        { status: 400 }
      );
    }

    // Create ZIP file
    const zip = new JSZip();

    // Generate PDF for each invoice
    for (const invoice of invoices) {
      // Calculate totals
      const invoiceWithRelations = invoice as any;
      const subtotal = invoiceWithRelations.items.reduce(
        (sum: number, item: any) => sum + item.price * item.quantity,
        0
      );
      // Manual tax from item taxRate
      const manualTax = invoiceWithRelations.items.reduce(
        (sum: number, item: any) =>
          sum + item.price * item.quantity * (item.taxRate / 100),
        0
      );
      // Custom tax from invoice taxes
      const customTax =
        invoiceWithRelations.invoiceTaxes?.reduce(
          (sum: number, tax: any) => sum + tax.amount,
          0
        ) || 0;
      const totalTax = manualTax + customTax;
      const total = subtotal + totalTax;
      const totalPaid = invoiceWithRelations.payments.reduce(
        (sum: number, p: any) => sum + p.amount,
        0
      );
      const balance = total - totalPaid;

      // Generate PDF
      const pdfElement = (
        <InvoicePDF
          invoice={{
            ...invoiceWithRelations,
            subtotal,
            manualTax,
            customTax,
            invoiceTaxes: invoiceWithRelations.invoiceTaxes || [],
            tax: totalTax,
            total,
            totalPaid,
            balance,
            taxCalculationMethod: invoiceWithRelations.taxCalculationMethod
          }}
        />
      ) as React.ReactElement<DocumentProps>;

      const pdfStream = await renderToStream(pdfElement);

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of pdfStream) {
        chunks.push(Buffer.from(chunk));
      }
      const pdfBuffer = Buffer.concat(chunks);

      // Add to ZIP with filename
      const filename = `invoice-${invoice.invoiceNo}.pdf`;
      zip.file(filename, pdfBuffer);
    }

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const timestamp = new Date().toISOString().split('T')[0];
    return new NextResponse(zipBuffer as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="invoices-${timestamp}.zip"`
      }
    });
  } catch (error) {
    console.error('Error exporting invoices as PDF:', error);
    return NextResponse.json(
      { error: 'Failed to export invoices as PDF' },
      { status: 500 }
    );
  }
}
