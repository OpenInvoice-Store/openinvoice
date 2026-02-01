import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/**
 * Calculate invoice total including tax (manual + custom tax)
 */
function calculateInvoiceTotal(invoice: any): number {
  const subtotal = invoice.items.reduce(
    (sum: number, item: any) => sum + item.price * item.quantity,
    0
  );
  // Manual tax from item taxRate
  const manualTax = invoice.items.reduce(
    (sum: number, item: any) =>
      sum + item.price * item.quantity * (item.taxRate / 100),
    0
  );
  // Custom tax from invoice taxes (tax profile)
  const customTax = (invoice.invoiceTaxes || []).reduce(
    (sum: number, tax: any) => sum + tax.amount,
    0
  );
  return subtotal + manualTax + customTax;
}

/**
 * GET - Calculate Customer Lifetime Value (CLV) for all customers
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
    const customerId = searchParams.get('customerId'); // Optional: filter by customer

    // Get all customers
    const whereClause: any = { organizationId: orgId };
    if (customerId) {
      whereClause.id = customerId;
    }

    const customers = await prisma.customer.findMany({
      where: whereClause,
      include: {
        invoices: {
          include: {
            items: true,
            payments: true,
            invoiceTaxes: true
          },
          where: {
            status: { not: 'cancelled' }
          }
        },
        recurringInvoiceTemplates: {
          where: {
            status: 'active'
          },
          include: {
            invoices: {
              include: {
                items: true
              },
              take: 10 // For average calculation
            }
          }
        }
      }
    });

    const now = new Date();
    const clvData = customers.map((customer) => {
      // Calculate historical metrics
      const invoices = customer.invoices || [];
      const paidInvoices = invoices.filter(
        (inv) => inv.status === 'paid' || inv.payments.length > 0
      );

      // Total revenue from customer
      const totalRevenue = invoices.reduce(
        (sum, inv) => sum + calculateInvoiceTotal(inv),
        0
      );

      // Paid revenue (actual received)
      const paidRevenue = paidInvoices.reduce((sum, inv) => {
        const paidAmount = inv.payments.reduce(
          (total: number, payment: any) => total + payment.amount,
          0
        );
        return sum + (paidAmount || calculateInvoiceTotal(inv));
      }, 0);

      // Average order value
      const avgOrderValue =
        invoices.length > 0 ? totalRevenue / invoices.length : 0;

      // Purchase frequency (invoices per year)
      let purchaseFrequency = 0;
      if (invoices.length > 0) {
        const firstInvoice = invoices[invoices.length - 1];
        const lastInvoice = invoices[0];
        const daysDiff =
          (new Date(lastInvoice.createdAt).getTime() -
            new Date(firstInvoice.createdAt).getTime()) /
          (1000 * 60 * 60 * 24);

        if (daysDiff > 0) {
          purchaseFrequency = (invoices.length / daysDiff) * 365;
        } else {
          purchaseFrequency = invoices.length; // If all in same day, use count
        }
      }

      // Customer age (days since first invoice)
      let customerAge = 0;
      if (invoices.length > 0) {
        const firstInvoiceDate = new Date(
          invoices[invoices.length - 1].createdAt
        );
        customerAge = Math.floor(
          (now.getTime() - firstInvoiceDate.getTime()) / (1000 * 60 * 60 * 24)
        );
      } else {
        // If no invoices, use customer creation date
        customerAge = Math.floor(
          (now.getTime() - new Date(customer.createdAt).getTime()) /
            (1000 * 60 * 60 * 24)
        );
      }

      // Calculate future value from recurring invoices
      let projectedFutureValue = 0;
      const activeRecurring = customer.recurringInvoiceTemplates || [];
      activeRecurring.forEach((template) => {
        // Calculate average invoice value
        let avgInvoiceValue = 0;
        if (template.invoices.length > 0) {
          const totalValue = template.invoices.reduce(
            (sum, inv) => sum + calculateInvoiceTotal(inv),
            0
          );
          avgInvoiceValue = totalValue / template.invoices.length;
        } else {
          // Calculate from template items
          const items = JSON.parse(template.templateItems);
          avgInvoiceValue = items.reduce((sum: number, item: any) => {
            const subtotal = item.price * item.quantity;
            const tax = (subtotal * (item.taxRate || 0)) / 100;
            return sum + subtotal + tax;
          }, 0);
        }

        // Project for next 12 months
        let checkDate = new Date(template.nextGenerationDate);
        const endDate = template.endDate ? new Date(template.endDate) : null;
        const projectionEnd = new Date(now);
        projectionEnd.setMonth(projectionEnd.getMonth() + 12);

        let generations = 0;
        while (
          checkDate <= projectionEnd &&
          (!endDate || checkDate <= endDate) &&
          template.status === 'active'
        ) {
          generations++;
          // Calculate next generation date
          switch (template.frequency) {
            case 'daily':
              checkDate.setDate(checkDate.getDate() + template.interval);
              break;
            case 'weekly':
              checkDate.setDate(checkDate.getDate() + 7 * template.interval);
              break;
            case 'biweekly':
              checkDate.setDate(checkDate.getDate() + 14 * template.interval);
              break;
            case 'monthly':
              checkDate.setMonth(checkDate.getMonth() + template.interval);
              break;
            case 'quarterly':
              checkDate.setMonth(checkDate.getMonth() + 3 * template.interval);
              break;
            case 'yearly':
              checkDate.setFullYear(
                checkDate.getFullYear() + template.interval
              );
              break;
            case 'custom':
              checkDate.setDate(checkDate.getDate() + template.interval);
              break;
            default:
              checkDate.setMonth(checkDate.getMonth() + 1);
          }
          if (generations > 12) break; // Prevent infinite loop
        }

        projectedFutureValue += avgInvoiceValue * generations;
      });

      // Calculate CLV using formula: (Avg Order Value × Purchase Frequency × Customer Lifespan) + Projected Future Value
      // Customer lifespan is estimated as customer age in years, or 1 year minimum
      const customerLifespanYears = Math.max(1, customerAge / 365);
      const historicalCLV =
        avgOrderValue * purchaseFrequency * customerLifespanYears;
      const totalCLV = historicalCLV + projectedFutureValue;

      // Calculate predicted CLV (next 12 months)
      const predictedCLV =
        projectedFutureValue + avgOrderValue * purchaseFrequency;

      // Customer value score (0-100)
      const valueScore = Math.min(
        100,
        Math.max(0, (totalCLV / Math.max(1, customerAge / 365) / 10000) * 100)
      );

      // Customer segment
      let segment = 'Low Value';
      if (totalCLV > 50000) {
        segment = 'High Value';
      } else if (totalCLV > 10000) {
        segment = 'Medium Value';
      }

      return {
        customerId: customer.id,
        customerName: customer.name,
        customerEmail: customer.email,
        metrics: {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          paidRevenue: Math.round(paidRevenue * 100) / 100,
          avgOrderValue: Math.round(avgOrderValue * 100) / 100,
          purchaseFrequency: Math.round(purchaseFrequency * 100) / 100,
          customerAge: customerAge,
          customerAgeYears: Math.round((customerAge / 365) * 100) / 100,
          totalInvoices: invoices.length,
          paidInvoices: paidInvoices.length,
          activeRecurringTemplates: activeRecurring.length
        },
        clv: {
          historical: Math.round(historicalCLV * 100) / 100,
          projectedFuture: Math.round(projectedFutureValue * 100) / 100,
          total: Math.round(totalCLV * 100) / 100,
          predicted12Months: Math.round(predictedCLV * 100) / 100
        },
        valueScore: Math.round(valueScore),
        segment
      };
    });

    // Sort by total CLV (descending)
    clvData.sort((a, b) => b.clv.total - a.clv.total);

    // Calculate summary statistics
    const totalCLV = clvData.reduce((sum, c) => sum + c.clv.total, 0);
    const avgCLV = clvData.length > 0 ? totalCLV / clvData.length : 0;
    const highValueCount = clvData.filter(
      (c) => c.segment === 'High Value'
    ).length;
    const mediumValueCount = clvData.filter(
      (c) => c.segment === 'Medium Value'
    ).length;
    const lowValueCount = clvData.filter(
      (c) => c.segment === 'Low Value'
    ).length;

    return NextResponse.json({
      customers: clvData,
      summary: {
        totalCustomers: clvData.length,
        totalCLV: Math.round(totalCLV * 100) / 100,
        avgCLV: Math.round(avgCLV * 100) / 100,
        highValueCount,
        mediumValueCount,
        lowValueCount
      }
    });
  } catch (error) {
    console.error('Error calculating CLV:', error);
    return NextResponse.json(
      { error: 'Failed to calculate customer lifetime value' },
      { status: 500 }
    );
  }
}
