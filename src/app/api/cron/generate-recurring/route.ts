import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendInvoiceEmail } from '@/lib/email';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // If no secret is set, allow access (for development)
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

/**
 * GET - Generate invoices from active recurring templates
 * This endpoint should be called by a cron job (e.g., daily)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Get query parameters for testing
    const searchParams = request.nextUrl.searchParams;
    const debug = searchParams.get('debug') === 'true';
    const dryRun = searchParams.get('dryRun') === 'true';
    const forceAll = searchParams.get('forceAll') === 'true'; // Generate for all active templates regardless of date

    // Find templates that are ready to generate
    // nextGenerationDate <= now AND status = 'active' AND (endDate is null OR endDate >= now)
    const whereClause: any = {
      status: 'active',
      nextGenerationDate: {
        lte: now
      }
    };

    if (!forceAll) {
      whereClause.OR = [{ endDate: null }, { endDate: { gte: now } }];
    }

    const templates = await prisma.recurringInvoiceTemplate.findMany({
      where: whereClause,
      include: {
        customer: true,
        organization: true
      }
    });

    if (debug) {
      console.log(`Found ${templates.length} templates ready to generate`);
    }

    const results = {
      processed: 0,
      generated: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    for (const template of templates) {
      try {
        results.processed++;

        if (dryRun) {
          results.details.push({
            templateId: template.id,
            templateName: template.name,
            status: 'dry_run',
            wouldGenerate: true
          });
          continue;
        }

        // Calculate dates
        const issueDate = new Date();
        const dueDate = new Date(issueDate);
        dueDate.setDate(dueDate.getDate() + template.daysUntilDue);

        // Calculate billing period for usage-based invoices
        let billingPeriodStart: Date = issueDate; // Default value
        let billingPeriodEnd: Date = issueDate;

        if (template.isUsageBased) {
          // For usage-based, billing period is from lastGeneratedAt (or startDate) to now
          billingPeriodStart = template.lastGeneratedAt
            ? new Date(template.lastGeneratedAt)
            : new Date(template.startDate);
        }

        // Parse template items
        const baseItems = JSON.parse(template.templateItems);

        // For usage-based billing, calculate quantities from usage records
        let invoiceItems: any[] = [];
        let usageRecordIds: string[] = [];

        if (template.isUsageBased) {
          // Find unbilled usage records for this period
          const usageRecords = await prisma.usageRecord.findMany({
            where: {
              recurringTemplateId: template.id,
              invoiceId: null, // Only unbilled records
              periodStart: { gte: billingPeriodStart },
              periodEnd: { lte: billingPeriodEnd }
            },
            orderBy: { periodStart: 'asc' }
          });

          if (usageRecords.length === 0) {
            // Skip this template if no usage records
            results.skipped++;
            results.details.push({
              templateId: template.id,
              templateName: template.name,
              status: 'skipped',
              reason: 'No usage records found for billing period'
            });
            continue;
          }

          // Calculate total usage quantity
          const totalUsage = usageRecords.reduce(
            (sum, record) => sum + record.quantity,
            0
          );

          // Create invoice items based on usage
          invoiceItems = baseItems.map((item: any) => ({
            productId: item.productId,
            description: `${item.description} (${totalUsage} ${template.usageUnit || 'units'})`,
            quantity: Math.ceil(totalUsage * item.quantity),
            price: parseFloat(item.price),
            taxRate: item.taxRate ? parseFloat(item.taxRate) : 0
          }));

          usageRecordIds = usageRecords.map((r) => r.id);
        } else {
          // For fixed billing, use template items as-is
          invoiceItems = baseItems.map((item: any) => ({
            productId: item.productId,
            description: item.description,
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price),
            taxRate: item.taxRate ? parseFloat(item.taxRate) : 0
          }));
        }

        // Get currency from template or organization default
        const invoiceCurrency =
          (template as any).currency ||
          (template.organization as any)?.defaultCurrency ||
          'USD';

        // Generate invoice
        const invoice = await prisma.$transaction(
          async (tx) => {
            // Atomically increment counter
            const counter = await tx.invoiceCounter.upsert({
              where: { organizationId: template.organizationId },
              update: { lastInvoiceNo: { increment: 1 } },
              create: {
                organizationId: template.organizationId,
                lastInvoiceNo: 1
              }
            });

            // Create invoice
            const newInvoice = await tx.invoice.create({
              data: {
                invoiceNo: counter.lastInvoiceNo,
                customerId: template.customerId,
                organizationId: template.organizationId,
                dueDate,
                issueDate,
                status: template.autoSendEmail ? 'sent' : 'draft',
                notes: template.templateNotes || null,
                recurringTemplateId: template.id,
                currency: invoiceCurrency,
                items: {
                  create: invoiceItems
                }
              },
              include: {
                customer: true,
                items: {
                  include: {
                    product: true
                  }
                }
              }
            });

            // Link usage records to invoice if usage-based
            if (template.isUsageBased && usageRecordIds.length > 0) {
              await tx.usageRecord.updateMany({
                where: {
                  id: { in: usageRecordIds }
                },
                data: {
                  invoiceId: newInvoice.id
                }
              });
            }

            return newInvoice;
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
            maxWait: 5000,
            timeout: 10000
          }
        );

        // Generate share token
        const shareToken = randomBytes(32).toString('base64url');
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { shareToken }
        });

        // Send email if auto-send is enabled
        let emailSent = false;
        if (template.autoSendEmail && template.customer.email) {
          try {
            const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;
            const pdfUrl = `${baseUrl}/api/invoices/${invoice.id}/pdf`;

            // Fetch invoice with taxes
            const invoiceWithTaxes = await prisma.invoice.findUnique({
              where: { id: invoice.id },
              include: { invoiceTaxes: true }
            });

            // Calculate totals
            const subtotal = invoice.items.reduce(
              (sum, item) => sum + item.price * item.quantity,
              0
            );
            // Manual tax from item taxRate
            const manualTax = invoice.items.reduce(
              (sum, item) =>
                sum + item.price * item.quantity * (item.taxRate / 100),
              0
            );
            // Custom tax from invoice taxes
            const customTax =
              invoiceWithTaxes?.invoiceTaxes?.reduce(
                (sum, tax) => sum + tax.amount,
                0
              ) || 0;
            const total = subtotal + manualTax + customTax;

            await sendInvoiceEmail({
              to: template.customer.email,
              customerName: template.customer.name,
              invoiceNo: invoice.invoiceNo,
              invoiceUrl,
              pdfUrl,
              issueDate: invoice.issueDate,
              dueDate: invoice.dueDate,
              total,
              subtotal,
              manualTax,
              invoiceTaxes:
                invoiceWithTaxes?.invoiceTaxes?.map((tax) => ({
                  name: tax.name,
                  rate: tax.rate,
                  amount: tax.amount,
                  authority: tax.authority || undefined
                })) || [],
              currency:
                invoice.currency ||
                template.organization?.defaultCurrency ||
                'USD',
              organizationName: template.organization?.name,
              organizationId: template.organizationId
            });

            // Log the email
            await prisma.emailLog.create({
              data: {
                invoiceId: invoice.id,
                emailType: 'invoice',
                recipient: template.customer.email,
                status: 'sent'
              }
            });

            emailSent = true;
          } catch (emailError) {
            console.error(
              `Error sending email for template ${template.id}:`,
              emailError
            );
            // Don't fail the whole operation if email fails
          }
        }

        // Calculate next generation date
        const nextGenDate = calculateNextGenerationDate(
          template.frequency,
          template.interval,
          issueDate
        );

        // Check if we've reached the end date
        let newStatus = template.status;
        if (template.endDate && nextGenDate > template.endDate) {
          newStatus = 'completed';
        }

        // Update template
        await prisma.recurringInvoiceTemplate.update({
          where: { id: template.id },
          data: {
            nextGenerationDate: nextGenDate,
            lastGeneratedAt: issueDate,
            totalGenerated: { increment: 1 },
            status: newStatus
          }
        });

        results.generated++;
        results.details.push({
          templateId: template.id,
          templateName: template.name,
          invoiceId: invoice.id,
          invoiceNo: invoice.invoiceNo,
          status: 'success',
          emailSent,
          nextGenerationDate: nextGenDate
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          templateId: template.id,
          templateName: template.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        console.error(`Error processing template ${template.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      summary: results,
      message: `Processed ${results.processed} templates. Generated ${results.generated} invoices.`
    });
  } catch (error) {
    console.error('Error in generate-recurring cron job:', error);
    return NextResponse.json(
      {
        error: 'Failed to process recurring invoices',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Calculate the next generation date based on frequency
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
      // For custom, interval is in days
      nextDate.setDate(nextDate.getDate() + interval);
      break;
    default:
      // Default to monthly
      nextDate.setMonth(nextDate.getMonth() + 1);
  }

  return nextDate;
}
