import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { filterVisiblePayments } from '@/lib/payment-utils';
import * as XLSX from 'xlsx';

/**
 * GET - Export payments to CSV or Excel
 * Query params: format (csv|xlsx), invoiceId (optional)
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
    const format = searchParams.get('format') || 'csv';
    const invoiceId = searchParams.get('invoiceId');

    const allPayments = await prisma.payment.findMany({
      where: {
        invoice: {
          organizationId: orgId,
          ...(invoiceId && { id: invoiceId })
        }
      },
      include: {
        invoice: {
          include: {
            customer: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter out pending crypto payments (amount = 0) - these are payment requests, not actual payments
    const payments = filterVisiblePayments(allPayments);

    if (payments.length === 0) {
      return NextResponse.json(
        { error: 'No payments found to export' },
        { status: 404 }
      );
    }

    const exportData = payments.map((payment) => ({
      'Payment ID': payment.id,
      'Invoice #': payment.invoice?.invoiceNo || '',
      'Customer Name': payment.invoice?.customer?.name || '',
      Amount: payment.amount.toFixed(2),
      Method: payment.method,
      Date: new Date(payment.date).toLocaleString(),
      Notes: payment.notes || '',
      'Stripe Payment Intent': payment.stripePaymentIntentId || '',
      'Created At': new Date(payment.createdAt).toLocaleString()
    }));

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Payments');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      });
    } else {
      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map((row) =>
          headers
            .map((header) => {
              const value = row[header as keyof typeof row];
              if (value === null || value === undefined) return '';
              const stringValue = String(value);
              if (
                stringValue.includes(',') ||
                stringValue.includes('"') ||
                stringValue.includes('\n')
              ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(',')
        )
      ].join('\n');

      return new NextResponse(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
  } catch (error) {
    console.error('Error exporting payments:', error);
    return NextResponse.json(
      { error: 'Failed to export payments' },
      { status: 500 }
    );
  }
}
