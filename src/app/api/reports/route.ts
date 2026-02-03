import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { filterVisiblePayments } from '@/lib/payment-utils';

/**
 * GET - Generate custom report based on parameters
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
            id: inv.id,
            invoiceNo: inv.invoiceNo,
            customerName: inv.customer?.name || '',
            issueDate: inv.issueDate,
            dueDate: inv.dueDate,
            status: inv.status,
            total,
            totalPaid,
            balance,
            ...(includeItems && { items }),
            ...(includePayments && { payments })
          };
        });

        // Group results if needed
        if (groupBy === 'customer') {
          const groupedData = new Map<string, any>();
          results.forEach((inv) => {
            const key = inv.customerName || 'Unknown';
            if (!groupedData.has(key)) {
              groupedData.set(key, { group: key, count: 0, total: 0 });
            }
            const group = groupedData.get(key);
            group.count++;
            group.total += inv.total;
          });
          results = Array.from(groupedData.values()).map((g) => ({
            ...g,
            average: g.total / g.count
          }));
        } else if (groupBy === 'status') {
          const groupedData = new Map<string, any>();
          results.forEach((inv) => {
            const key = inv.status;
            if (!groupedData.has(key)) {
              groupedData.set(key, { group: key, count: 0, total: 0 });
            }
            const group = groupedData.get(key);
            group.count++;
            group.total += inv.total;
          });
          results = Array.from(groupedData.values()).map((g) => ({
            ...g,
            average: g.total / g.count
          }));
        } else if (groupBy === 'month') {
          const groupedData = new Map<string, any>();
          results.forEach((inv) => {
            const date = new Date(inv.issueDate);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!groupedData.has(key)) {
              groupedData.set(key, { group: key, count: 0, total: 0 });
            }
            const group = groupedData.get(key);
            group.count++;
            group.total += inv.total;
          });
          results = Array.from(groupedData.values())
            .map((g) => ({
              ...g,
              average: g.total / g.count,
              group: new Date(g.group + '-01').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long'
              })
            }))
            .sort((a, b) => a.group.localeCompare(b.group));
        }

        // Calculate summary
        const totalRevenue = results.reduce(
          (sum, inv) => sum + (inv.total || inv.total || 0),
          0
        );
        summary = {
          totalRevenue,
          totalCount: results.length,
          averageAmount: results.length > 0 ? totalRevenue / results.length : 0
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

        const allPayments = await prisma.payment.findMany({
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

        // Filter out pending crypto payments (amount = 0) - these are payment requests, not actual payments
        const payments = filterVisiblePayments(allPayments);

        results = payments.map((payment) => ({
          id: payment.id,
          date: payment.date,
          invoiceNo: payment.invoice?.invoiceNo,
          customerName: payment.invoice?.customer?.name || '',
          method: payment.method,
          amount: payment.amount
        }));

        if (groupBy === 'month') {
          const groupedData = new Map<string, any>();
          results.forEach((payment) => {
            const date = new Date(payment.date);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!groupedData.has(key)) {
              groupedData.set(key, { group: key, count: 0, total: 0 });
            }
            const group = groupedData.get(key);
            group.count++;
            group.total += payment.amount;
          });
          results = Array.from(groupedData.values())
            .map((g) => ({
              ...g,
              average: g.total / g.count,
              group: new Date(g.group + '-01').toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long'
              })
            }))
            .sort((a, b) => a.group.localeCompare(b.group));
        }

        summary = {
          totalRevenue: results.reduce(
            (sum, p) => sum + (p.total || p.amount || 0),
            0
          ),
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
              (s, item) =>
                s + item.price * item.quantity * (item.taxRate / 100),
              0
            );
            return sum + subtotal + tax;
          }, 0);

          return {
            id: customer.id,
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
          id: product.id,
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
            ...(Object.keys(dateFilter).length > 0 && {
              issueDate: dateFilter
            }),
            ...(status && { status }),
            ...(customerId && { customerId })
          },
          include: {
            items: true
          },
          orderBy: { issueDate: 'asc' }
        });

        // Group by month
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

    return NextResponse.json({
      results,
      summary,
      grouped,
      reportType,
      filters: {
        startDate,
        endDate,
        status,
        customerId,
        groupBy
      }
    });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    );
  }
}
