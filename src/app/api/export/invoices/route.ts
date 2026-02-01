import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as XLSX from 'xlsx';

/**
 * GET - Export invoices to CSV or Excel
 * Query params: format (csv|xlsx), status (optional), customerId (optional)
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
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');

    // Fetch invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        ...(status && { status }),
        ...(customerId && { customerId })
      },
      include: {
        customer: true,
        items: true,
        payments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (invoices.length === 0) {
      return NextResponse.json(
        { error: 'No invoices found to export' },
        { status: 404 }
      );
    }

    // Format data for export
    const exportData = invoices.map((invoice) => {
      const subtotal = invoice.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const tax = invoice.items.reduce(
        (sum, item) => sum + item.price * item.quantity * (item.taxRate / 100),
        0
      );
      const total = subtotal + tax;
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = total - totalPaid;

      return {
        'Invoice #': invoice.invoiceNo,
        'Customer Name': invoice.customer?.name || '',
        'Customer Email': invoice.customer?.email || '',
        'Issue Date': new Date(invoice.issueDate).toLocaleDateString(),
        'Due Date': new Date(invoice.dueDate).toLocaleDateString(),
        Status: invoice.status,
        Subtotal: subtotal.toFixed(2),
        Tax: tax.toFixed(2),
        Total: total.toFixed(2),
        'Total Paid': totalPaid.toFixed(2),
        Balance: balance.toFixed(2),
        'Item Count': invoice.items.length,
        'Payment Count': invoice.payments.length,
        Notes: invoice.notes || '',
        'Created At': new Date(invoice.createdAt).toLocaleString()
      };
    });

    if (format === 'xlsx') {
      // Export to Excel
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoices');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="invoices-${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      });
    } else {
      // Export to CSV
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
          'Content-Disposition': `attachment; filename="invoices-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
  } catch (error) {
    console.error('Error exporting invoices:', error);
    return NextResponse.json(
      { error: 'Failed to export invoices' },
      { status: 500 }
    );
  }
}
