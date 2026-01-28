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
 * Calculate next generation date based on frequency
 */
function calculateNextGenerationDate(
  frequency: string,
  interval: number,
  currentDate: Date
): Date {
  const nextDate = new Date(currentDate);

  switch (frequency) {
    case 'daily':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    case 'weekly':
      nextDate.setDate(nextDate.getDate() + 7 * interval);
      break;
    case 'biweekly':
      nextDate.setDate(nextDate.getDate() + 14 * interval);
      break;
    case 'monthly':
      nextDate.setMonth(nextDate.getMonth() + interval);
      break;
    case 'quarterly':
      nextDate.setMonth(nextDate.getMonth() + 3 * interval);
      break;
    case 'yearly':
      nextDate.setFullYear(nextDate.getFullYear() + interval);
      break;
    case 'custom':
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    default:
      nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate;
}

/**
 * GET - Generate financial forecasts based on historical data and recurring invoices
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
    const period = searchParams.get('period') || '12'; // months to forecast

    // Get historical invoices for trend analysis
    const historicalInvoices = await prisma.invoice.findMany({
      where: {
        organizationId: orgId,
        status: { not: 'cancelled' }
      },
      include: {
        items: true,
        invoiceTaxes: true
      },
      orderBy: { issueDate: 'asc' }
    });

    // Get active recurring invoice templates
    const recurringTemplates = await prisma.recurringInvoiceTemplate.findMany({
      where: {
        organizationId: orgId,
        status: 'active'
      },
      include: {
        customer: true,
        invoices: {
          include: {
            items: true,
            invoiceTaxes: true
          },
          orderBy: { issueDate: 'desc' },
          take: 10 // Get recent invoices for average calculation
        }
      }
    });

    const now = new Date();
    const forecastMonths = parseInt(period);
    const forecasts: Array<{
      month: string;
      monthKey: string;
      projectedRevenue: number;
      recurringRevenue: number;
      trendRevenue: number;
      confidence: number;
    }> = [];

    // Calculate historical monthly revenue for trend analysis
    const monthlyRevenue: Record<string, number> = {};
    historicalInvoices.forEach((invoice) => {
      const date = new Date(invoice.issueDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyRevenue[monthKey] =
        (monthlyRevenue[monthKey] || 0) + calculateInvoiceTotal(invoice);
    });

    // Calculate average monthly revenue from last 6 months
    const last6Months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now);
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      last6Months.push(monthKey);
    }

    const last6MonthsRevenue = last6Months
      .map((key) => monthlyRevenue[key] || 0)
      .filter((r) => r > 0);

    const avgMonthlyRevenue =
      last6MonthsRevenue.length > 0
        ? last6MonthsRevenue.reduce((sum, r) => sum + r, 0) /
          last6MonthsRevenue.length
        : 0;

    // Calculate trend (simple linear regression on last 6 months)
    let trend = 0;
    if (last6MonthsRevenue.length >= 3) {
      const values = last6MonthsRevenue;
      const n = values.length;
      const sumX = (n * (n - 1)) / 2; // Sum of indices
      const sumY = values.reduce((sum, v) => sum + v, 0);
      const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
      const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6; // Sum of squares of indices

      trend = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    // Generate forecasts for each month
    for (let i = 1; i <= forecastMonths; i++) {
      const forecastDate = new Date(now);
      forecastDate.setMonth(forecastDate.getMonth() + i);
      const monthKey = `${forecastDate.getFullYear()}-${String(forecastDate.getMonth() + 1).padStart(2, '0')}`;
      const monthName = forecastDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long'
      });

      // Calculate recurring revenue from active templates
      let recurringRevenue = 0;
      recurringTemplates.forEach((template) => {
        // Check if template will generate in this month
        let checkDate = new Date(template.nextGenerationDate);
        const endDate = template.endDate ? new Date(template.endDate) : null;

        // Calculate how many times this template will generate in this month
        let generations = 0;
        while (
          checkDate <=
            new Date(
              forecastDate.getFullYear(),
              forecastDate.getMonth() + 1,
              0
            ) &&
          (!endDate || checkDate <= endDate) &&
          template.status === 'active'
        ) {
          if (
            checkDate >=
              new Date(
                forecastDate.getFullYear(),
                forecastDate.getMonth(),
                1
              ) &&
            checkDate <=
              new Date(
                forecastDate.getFullYear(),
                forecastDate.getMonth() + 1,
                0
              )
          ) {
            generations++;
          }

          // Calculate average invoice value from recent invoices
          let avgInvoiceValue = 0;
          if (template.invoices.length > 0) {
            const totalValue = template.invoices.reduce(
              (sum, inv) => sum + calculateInvoiceTotal(inv),
              0
            );
            avgInvoiceValue = totalValue / template.invoices.length;
          } else {
            // If no invoices yet, calculate from template items
            const items = JSON.parse(template.templateItems);
            avgInvoiceValue = items.reduce((sum: number, item: any) => {
              const subtotal = item.price * item.quantity;
              const tax = (subtotal * (item.taxRate || 0)) / 100;
              return sum + subtotal + tax;
            }, 0);
          }

          recurringRevenue += avgInvoiceValue * generations;

          // Move to next generation date
          checkDate = calculateNextGenerationDate(
            template.frequency,
            template.interval,
            checkDate
          );

          // Prevent infinite loop
          if (generations > 12) break;
        }
      });

      // Calculate trend-based revenue (extrapolation)
      const trendRevenue = avgMonthlyRevenue + trend * i;

      // Combined projection (weighted: 60% recurring, 40% trend)
      const projectedRevenue =
        recurringRevenue * 0.6 + Math.max(0, trendRevenue) * 0.4;

      // Calculate confidence (higher for months with more recurring revenue)
      const confidence = Math.min(
        100,
        Math.max(
          30,
          50 + (recurringRevenue / Math.max(projectedRevenue, 1)) * 50
        )
      );

      forecasts.push({
        month: monthName,
        monthKey,
        projectedRevenue: Math.round(projectedRevenue * 100) / 100,
        recurringRevenue: Math.round(recurringRevenue * 100) / 100,
        trendRevenue: Math.round(Math.max(0, trendRevenue) * 100) / 100,
        confidence: Math.round(confidence)
      });
    }

    // Calculate summary statistics
    const totalProjected = forecasts.reduce(
      (sum, f) => sum + f.projectedRevenue,
      0
    );
    const avgProjected = totalProjected / forecasts.length;
    const avgConfidence =
      forecasts.reduce((sum, f) => sum + f.confidence, 0) / forecasts.length;

    return NextResponse.json({
      forecasts,
      summary: {
        totalProjected: Math.round(totalProjected * 100) / 100,
        avgMonthlyProjected: Math.round(avgProjected * 100) / 100,
        avgConfidence: Math.round(avgConfidence),
        activeRecurringTemplates: recurringTemplates.length,
        historicalAvgMonthly: Math.round(avgMonthlyRevenue * 100) / 100,
        trend: Math.round(trend * 100) / 100
      }
    });
  } catch (error) {
    console.error('Error generating financial forecast:', error);
    return NextResponse.json(
      { error: 'Failed to generate financial forecast' },
      { status: 500 }
    );
  }
}
