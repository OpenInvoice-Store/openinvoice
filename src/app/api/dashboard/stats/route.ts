import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

function calculateInvoiceTotal(invoice: any): number {
  const subtotal = invoice.items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );
  const tax = invoice.items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  return subtotal + tax;
}

export async function GET() {
  try {
    const { orgId } = await auth();
    
    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    // Get all invoices with items for this organization
    const invoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
      },
      include: {
        items: true,
        payments: true,
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total revenue (from paid invoices or all invoices)
    const totalRevenue = invoices.reduce((sum, invoice) => {
      return sum + calculateInvoiceTotal(invoice);
    }, 0);

    // Calculate paid revenue (only from paid invoices or payments)
    const paidRevenue = invoices.reduce((sum, invoice) => {
      if (invoice.status === 'paid' || invoice.payments.length > 0) {
        const paidAmount = invoice.payments.reduce(
          (total: number, payment: any) => total + payment.amount,
          0
        );
        return sum + (paidAmount || calculateInvoiceTotal(invoice));
      }
      return sum;
    }, 0);

    // Count unique customers
    const uniqueCustomers = new Set(invoices.map((inv) => inv.customerId)).size;
    const totalCustomers = await prisma.customer.count({
      where: { organizationId: orgId },
    });

    // Count invoices by status
    const invoiceCounts = {
      total: invoices.length,
      draft: invoices.filter((inv) => inv.status === 'draft').length,
      sent: invoices.filter((inv) => inv.status === 'sent').length,
      paid: invoices.filter((inv) => inv.status === 'paid').length,
      overdue: invoices.filter((inv) => inv.status === 'overdue').length,
      cancelled: invoices.filter((inv) => inv.status === 'cancelled').length,
    };

    // Calculate growth (compare this month vs last month)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const thisMonthInvoices = invoices.filter(
      (inv) => new Date(inv.createdAt) >= currentMonthStart
    );
    const lastMonthInvoices = invoices.filter(
      (inv) =>
        new Date(inv.createdAt) >= lastMonthStart &&
        new Date(inv.createdAt) <= lastMonthEnd
    );

    const thisMonthRevenue = thisMonthInvoices.reduce(
      (sum, inv) => sum + calculateInvoiceTotal(inv),
      0
    );
    const lastMonthRevenue = lastMonthInvoices.reduce(
      (sum, inv) => sum + calculateInvoiceTotal(inv),
      0
    );

    const revenueGrowth =
      lastMonthRevenue > 0
        ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : 0;

    // Get recent invoices for recent sales (last 5)
    const recentInvoices = invoices.slice(0, 5).map((invoice) => ({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      customerName: invoice.customer?.name || 'Unknown',
      customerEmail: invoice.customer?.email || null,
      amount: calculateInvoiceTotal(invoice),
      status: invoice.status,
      createdAt: invoice.createdAt,
    }));

    // Calculate revenue by day for the last 90 days (for bar chart)
    const revenueByDay: Record<string, number> = {};
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    invoices
      .filter((inv) => new Date(inv.createdAt) >= ninetyDaysAgo)
      .forEach((invoice) => {
        const date = new Date(invoice.createdAt).toISOString().split('T')[0];
        revenueByDay[date] = (revenueByDay[date] || 0) + calculateInvoiceTotal(invoice);
      });

    // Calculate invoice count by month for the last 6 months (for area chart)
    const invoicesByMonth: Record<string, number> = {};
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    invoices
      .filter((inv) => new Date(inv.createdAt) >= sixMonthsAgo)
      .forEach((invoice) => {
        const date = new Date(invoice.createdAt);
        const monthKey = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        invoicesByMonth[monthKey] = (invoicesByMonth[monthKey] || 0) + 1;
      });

    return NextResponse.json({
      totalRevenue,
      paidRevenue,
      totalCustomers,
      uniqueCustomersWithInvoices: uniqueCustomers,
      invoiceCounts,
      revenueGrowth,
      recentInvoices,
      revenueByDay,
      invoicesByMonth,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
