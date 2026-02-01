import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as XLSX from 'xlsx';

// Helper function to generate report data (shared logic)
async function generateReportData(
  orgId: string,
  reportType: string,
  dateFilter: any,
  status: string | null,
  customerId: string | null,
  groupBy: string,
  includeItems: boolean,
  includePayments: boolean
) {
  let results: any[] = [];
  let summary: any = {};
  let grouped = groupBy !== 'none';

  switch (reportType) {
    case 'invoices': {
      const where: any = {
        organizationId: orgId,
        ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter }),
        ...(status && { status }),
        ...(customerId && { customerId })
      };

      const invoices = await prisma.invoice.findMany({
        where,
        include: {
          customer: true,
          items: includeItems,
          payments: includePayments
        },
        orderBy: { issueDate: 'desc' }
      });

      results = invoices.map((inv) => {
        const items = inv.items || [];
        const payments = inv.payments || [];

        const subtotal = items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const tax = items.reduce(
          (sum, item) =>
            sum + item.price * item.quantity * (item.taxRate / 100),
          0
        );
        const total = subtotal + tax;
        const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
        const balance = total - totalPaid;

        return {
          invoiceNo: inv.invoiceNo,
          customerName: inv.customer?.name || '',
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          status: inv.status,
          total,
          totalPaid,
          balance
        };
      });

      summary = {
        totalRevenue: results.reduce((sum, inv) => sum + inv.total, 0),
        totalCount: results.length,
        averageAmount:
          results.length > 0
            ? results.reduce((sum, inv) => sum + inv.total, 0) / results.length
            : 0
      };
      break;
    }
    case 'payments': {
      const where: any = {
        invoice: {
          organizationId: orgId,
          ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter })
        },
        ...(customerId && {
          invoice: { customerId }
        })
      };

      const payments = await prisma.payment.findMany({
        where,
        include: {
          invoice: {
            include: {
              customer: true
            }
          }
        },
        orderBy: { date: 'desc' }
      });

      results = payments.map((payment) => ({
        date: payment.date,
        invoiceNo: payment.invoice?.invoiceNo,
        customerName: payment.invoice?.customer?.name || '',
        method: payment.method,
        amount: payment.amount
      }));

      summary = {
        totalRevenue: results.reduce((sum, p) => sum + p.amount, 0),
        totalCount: results.length
      };
      break;
    }
    case 'customers': {
      const customers = await prisma.customer.findMany({
        where: {
          organizationId: orgId
        },
        include: {
          invoices: {
            where:
              Object.keys(dateFilter).length > 0
                ? { issueDate: dateFilter }
                : {},
            include: {
              items: true
            }
          }
        }
      });

      results = customers.map((customer) => {
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
          name: customer.name,
          email: customer.email,
          totalInvoices: customer.invoices.length,
          totalRevenue
        };
      });

      summary = {
        totalCount: results.length,
        totalRevenue: results.reduce((sum, c) => sum + c.totalRevenue, 0)
      };
      break;
    }
    case 'products': {
      const products = await prisma.product.findMany({
        where: {
          organizationId: orgId
        },
        include: {
          invoiceItems: {
            where:
              Object.keys(dateFilter).length > 0
                ? {
                    invoice: {
                      issueDate: dateFilter
                    }
                  }
                : {}
          }
        }
      });

      results = products.map((product) => ({
        name: product.name,
        price: product.price,
        taxRate: product.taxRate,
        timesUsed: product.invoiceItems.length
      }));

      summary = {
        totalCount: results.length
      };
      break;
    }
    case 'revenue': {
      const invoices = await prisma.invoice.findMany({
        where: {
          organizationId: orgId,
          ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter }),
          ...(status && { status }),
          ...(customerId && { customerId })
        },
        include: {
          items: true
        },
        orderBy: { issueDate: 'asc' }
      });

      const groupedData = new Map<string, any>();
      invoices.forEach((inv) => {
        const date = new Date(inv.issueDate);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!groupedData.has(key)) {
          groupedData.set(key, {
            period: new Date(key + '-01').toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long'
            }),
            revenue: 0,
            count: 0
          });
        }
        const group = groupedData.get(key);
        const subtotal = inv.items.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        const tax = inv.items.reduce(
          (sum, item) =>
            sum + item.price * item.quantity * (item.taxRate / 100),
          0
        );
        group.revenue += subtotal + tax;
        group.count++;
      });

      results = Array.from(groupedData.values()).map((g) => ({
        ...g,
        average: g.revenue / g.count
      }));

      summary = {
        totalRevenue: results.reduce((sum, r) => sum + r.revenue, 0),
        totalCount: invoices.length
      };
      break;
    }
  }

  return { results, summary, grouped };
}

/**
 * GET - Export report data as CSV or Excel
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
    const reportType = searchParams.get('reportType') || 'invoices';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customerId');
    const groupBy = searchParams.get('groupBy') || 'none';
    const includeItems = searchParams.get('includeItems') === 'true';
    const includePayments = searchParams.get('includePayments') === 'true';

    // Build date filter
    const dateFilter: any = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    const { results, summary, grouped } = await generateReportData(
      orgId,
      reportType,
      dateFilter,
      status,
      customerId,
      groupBy,
      includeItems,
      includePayments
    );

    const reportData = { results, summary, grouped };

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'No data to export' }, { status: 404 });
    }

    // Format data for export based on report type
    let exportData: any[] = [];

    if (reportData.grouped) {
      exportData = results.map((item: any) => ({
        Group: item.group || 'N/A',
        Count: item.count || 0,
        'Total Amount': item.total || 0,
        Average: item.average || 0
      }));
    } else {
      switch (reportType) {
        case 'invoices':
          exportData = results.map((inv: any) => ({
            'Invoice #': inv.invoiceNo,
            'Customer Name': inv.customerName || '',
            'Issue Date': new Date(inv.issueDate).toLocaleDateString(),
            'Due Date': new Date(inv.dueDate).toLocaleDateString(),
            Status: inv.status,
            Total: inv.total?.toFixed(2) || '0.00',
            'Total Paid': inv.totalPaid?.toFixed(2) || '0.00',
            Balance: inv.balance?.toFixed(2) || '0.00'
          }));
          break;
        case 'payments':
          exportData = results.map((payment: any) => ({
            Date: new Date(payment.date).toLocaleDateString(),
            'Invoice #': payment.invoiceNo || '',
            'Customer Name': payment.customerName || '',
            Method: payment.method || '',
            Amount:
              payment.amount?.toFixed(2) || payment.total?.toFixed(2) || '0.00'
          }));
          break;
        case 'customers':
          exportData = results.map((customer: any) => ({
            'Customer Name': customer.name,
            Email: customer.email || '',
            'Total Invoices': customer.totalInvoices || 0,
            'Total Revenue': customer.totalRevenue?.toFixed(2) || '0.00'
          }));
          break;
        case 'products':
          exportData = results.map((product: any) => ({
            'Product Name': product.name,
            Price: product.price?.toFixed(2) || '0.00',
            'Tax Rate (%)': product.taxRate?.toFixed(2) || '0.00',
            'Times Used': product.timesUsed || 0
          }));
          break;
        case 'revenue':
          exportData = results.map((item: any) => ({
            Period: item.period || 'N/A',
            Revenue: item.revenue?.toFixed(2) || '0.00',
            Count: item.count || 0,
            Average: item.average?.toFixed(2) || '0.00'
          }));
          break;
      }
    }

    // Add summary row if available
    if (summary && Object.keys(summary).length > 0) {
      exportData.push({});
      exportData.push({
        Summary: 'Total Revenue',
        Value: summary.totalRevenue?.toFixed(2) || '0.00'
      });
      if (summary.totalCount !== undefined) {
        exportData.push({
          Summary: 'Total Count',
          Value: summary.totalCount
        });
      }
      if (summary.averageAmount) {
        exportData.push({
          Summary: 'Average Amount',
          Value: summary.averageAmount.toFixed(2)
        });
      }
    }

    if (format === 'xlsx') {
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');

      const buffer = XLSX.write(workbook, {
        type: 'buffer',
        bookType: 'xlsx'
      });

      return new NextResponse(buffer, {
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="report-${reportType}-${new Date().toISOString().split('T')[0]}.xlsx"`
        }
      });
    } else {
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map((row: any) =>
          headers
            .map((header) => {
              const value = row[header];
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
          'Content-Disposition': `attachment; filename="report-${reportType}-${new Date().toISOString().split('T')[0]}.csv"`
        }
      });
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    return NextResponse.json(
      { error: 'Failed to export report' },
      { status: 500 }
    );
  }
}
