import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as XLSX from 'xlsx';

/**
 * GET - Export customers to CSV or Excel
 * Query params: format (csv|xlsx)
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

    // Fetch customers with invoice data
    const customers = await prisma.customer.findMany({
      where: {
        organizationId: orgId
      },
      include: {
        invoices: {
          include: {
            items: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (customers.length === 0) {
      return NextResponse.json(
        { error: 'No customers found to export' },
        { status: 404 }
      );
    }

    // Format data for export
    const exportData = customers.map((customer) => {
      const totalInvoices = customer.invoices.length;
      const totalRevenue = customer.invoices.reduce((sum, inv) => {
        const subtotal = inv.items.reduce(
          (s, item) => s + item.price * item.quantity,
          0
        );
        const tax = inv.items.reduce(
          (s, item) => s + item.price * item.quantity * (item.taxRate / 100),
          0
        );
        return sum + subtotal + tax;
      }, 0);

      return {
        'Customer Name': customer.name,
        Email: customer.email || '',
        Phone: customer.phone || '',
        Address: customer.address || '',
        'Total Invoices': totalInvoices,
        'Total Revenue': totalRevenue.toFixed(2),
        'Created At': new Date(customer.createdAt).toLocaleString(),
        'Updated At': new Date(customer.updatedAt).toLocaleString()
      };
    });

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.xlsx"`
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
          'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
  } catch (error) {
    console.error('Error exporting customers:', error);
    return NextResponse.json(
      { error: 'Failed to export customers' },
      { status: 500 }
    );
  }
}
