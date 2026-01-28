import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendPaymentReminderEmail } from '@/lib/email';
import { randomBytes } from 'crypto';

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    // If no secret is set, allow access (for development)
    // In production, you should set CRON_SECRET
    return true;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

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
    const testDays = searchParams.get('testDays'); // e.g., ?testDays=2 to test invoices due in 2 days
    const testOverdue = searchParams.get('testOverdue'); // e.g., ?testOverdue=5 to test invoices 5 days overdue
    const debug = searchParams.get('debug') === 'true'; // Show debug info
    const dryRun = searchParams.get('dryRun') === 'true'; // Don't actually send emails
    const sendAll = searchParams.get('sendAll') === 'true'; // Send to all matching invoices (flexible matching)

    // Configuration for reminder schedule
    const REMINDER_SCHEDULE = {
      // Send reminder 3 days before due date (or use testDays if provided)
      beforeDue: testDays ? parseInt(testDays, 10) : 3,
      // Send reminder on due date
      onDueDate: 0,
      // Send reminder 7 days after due date (or use testOverdue if provided)
      afterDue1: testOverdue ? parseInt(testOverdue, 10) : 7,
      // Send reminder 14 days after due date
      afterDue2: 14,
      // Send final notice 30 days after due date
      finalNotice: 30
    };

    // Calculate date ranges for each reminder type
    // For upcoming reminders - use a range instead of exact match
    const threeDaysBefore = new Date(now);
    threeDaysBefore.setDate(
      threeDaysBefore.getDate() + REMINDER_SCHEDULE.beforeDue
    );
    threeDaysBefore.setHours(0, 0, 0, 0);
    const threeDaysBeforeEnd = new Date(threeDaysBefore);
    threeDaysBeforeEnd.setHours(23, 59, 59, 999);

    const dueDateStart = new Date(now);
    dueDateStart.setHours(0, 0, 0, 0);
    const dueDateEnd = new Date(now);
    dueDateEnd.setHours(23, 59, 59, 999);

    // For testing overdue, calculate the target date
    const testOverdueDate = testOverdue
      ? new Date(
          now.getTime() - parseInt(testOverdue, 10) * 24 * 60 * 60 * 1000
        )
      : null;

    // Find invoices that need reminders
    // 1. Invoices due in X days (upcoming reminder)
    // If sendAll=true, get ALL unpaid invoices due in future, otherwise use exact date match
    const upcomingDateStart = sendAll ? now : threeDaysBefore;
    const upcomingDateEnd = sendAll
      ? new Date('2099-12-31') // Far future - get all future invoices
      : threeDaysBeforeEnd;

    const upcomingInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['sent', 'draft'] },
        dueDate: {
          gte: upcomingDateStart,
          lte: upcomingDateEnd
        },
        // If sendAll, ignore last reminder check completely
        ...(testDays || sendAll
          ? {}
          : {
              OR: [
                { lastReminderSentAt: null } as any,
                {
                  lastReminderSentAt: {
                    lt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
                  }
                } as any
              ]
            })
      },
      include: {
        customer: true,
        organization: true,
        items: true,
        payments: true,
        invoiceTaxes: true
      }
    });

    // 2. Invoices due today (due date reminder)
    const dueTodayInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['sent', 'draft'] },
        dueDate: {
          gte: dueDateStart,
          lte: dueDateEnd
        },
        // Only send if no reminder sent today (or if sendAll, ignore this)
        ...(sendAll
          ? {}
          : {
              OR: [
                { lastReminderSentAt: null } as any,
                {
                  lastReminderSentAt: {
                    lt: dueDateStart
                  }
                } as any
              ]
            })
      },
      include: {
        customer: true,
        organization: true,
        items: true,
        payments: true,
        invoiceTaxes: true
      }
    });

    // 3. Overdue invoices - make it more flexible
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['sent', 'overdue'] },
        dueDate: {
          lt: now, // Any invoice past due date
          // If testing specific overdue days, match that date range
          ...(testOverdueDate
            ? {
                gte: new Date(testOverdueDate.getTime() - 12 * 60 * 60 * 1000), // 12 hours before
                lte: new Date(testOverdueDate.getTime() + 12 * 60 * 60 * 1000) // 12 hours after
              }
            : {})
        },
        // Exclude paid invoices
        NOT: {
          status: 'paid'
        }
      },
      include: {
        customer: true,
        organization: true,
        items: true,
        payments: true,
        invoiceTaxes: true
      }
    });

    let sentCount = 0;
    let failedCount = 0;
    const results: Array<{
      invoiceId: string;
      invoiceNo: number;
      status: 'sent' | 'failed';
      reminderType: string;
      reason?: string;
    }> = [];

    // Process upcoming reminders
    for (const invoice of upcomingInvoices) {
      if (!invoice.customer.email) {
        // Log skipped invoices in debug mode
        if (debug) {
          results.push({
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            status: 'failed' as const,
            reminderType: 'upcoming',
            reason: 'No customer email'
          });
        }
        continue;
      }

      // Calculate days until due for the reminder
      const dueDate = new Date(invoice.dueDate);
      const daysUntilDue = Math.ceil(
        (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      const result = await sendReminderForInvoice(
        invoice,
        baseUrl,
        'upcoming',
        daysUntilDue,
        undefined,
        dryRun
      );
      results.push(result);
      if (result.status === 'sent') sentCount++;
      else failedCount++;
    }

    // Process due today reminders
    for (const invoice of dueTodayInvoices) {
      if (!invoice.customer.email) continue;

      const result = await sendReminderForInvoice(
        invoice,
        baseUrl,
        'upcoming',
        0,
        undefined,
        dryRun
      );
      results.push(result);
      if (result.status === 'sent') sentCount++;
      else failedCount++;
    }

    // Process overdue reminders
    for (const invoice of overdueInvoices) {
      if (!invoice.customer.email) {
        // Log skipped invoices in debug mode
        if (debug) {
          results.push({
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            status: 'failed' as const,
            reminderType: 'overdue',
            reason: 'No customer email'
          });
        }
        continue;
      }

      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = Math.ceil(
        (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Determine which reminder to send based on days overdue
      let reminderType: 'overdue' | 'final' = 'overdue';
      let shouldSend = false;

      // If testing specific overdue days, send reminder for any matching invoice
      if (testOverdue) {
        const targetDays = parseInt(testOverdue, 10);
        // Allow ±1 day tolerance for testing
        if (daysOverdue >= targetDays - 1 && daysOverdue <= targetDays + 1) {
          shouldSend = true;
          reminderType = daysOverdue >= 30 ? 'final' : 'overdue';
        }
      } else if (sendAll) {
        // Flexible mode: send to ALL overdue invoices, but respect minimum time between reminders
        const invoiceWithReminders = invoice as any;
        const daysSinceLastReminder = invoiceWithReminders.lastReminderSentAt
          ? Math.ceil(
              (now.getTime() -
                new Date(invoiceWithReminders.lastReminderSentAt).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : 999; // If never sent, treat as very old

        // Determine reminder type based on days overdue
        if (daysOverdue >= 30) {
          reminderType = 'final';
        } else {
          reminderType = 'overdue';
        }

        // Send if no reminder sent in last 3 days (more lenient for sendAll)
        if (
          daysSinceLastReminder >= 3 ||
          !invoiceWithReminders.lastReminderSentAt
        ) {
          shouldSend = true;
        }
      } else {
        // Normal logic: exact matches
        if (daysOverdue === REMINDER_SCHEDULE.afterDue1) {
          // 7 days overdue
          reminderType = 'overdue';
          shouldSend = true;
        } else if (daysOverdue === REMINDER_SCHEDULE.afterDue2) {
          // 14 days overdue
          reminderType = 'overdue';
          shouldSend = true;
        } else if (daysOverdue >= REMINDER_SCHEDULE.finalNotice) {
          // 30+ days overdue - final notice
          reminderType = 'final';
          // Only send final notice if last reminder was more than 7 days ago
          const invoiceWithReminders = invoice as any;
          if (
            !invoiceWithReminders.lastReminderSentAt ||
            new Date(invoiceWithReminders.lastReminderSentAt).getTime() <
              now.getTime() - 7 * 24 * 60 * 60 * 1000
          ) {
            shouldSend = true;
          }
        }
      }

      if (shouldSend) {
        const result = await sendReminderForInvoice(
          invoice,
          baseUrl,
          reminderType,
          undefined,
          daysOverdue,
          dryRun
        );
        results.push(result);
        if (result.status === 'sent') sentCount++;
        else failedCount++;
      }
    }

    // Mark overdue invoices (skip in dry run)
    if (!dryRun) {
      await markOverdueInvoices();
    }

    // Build response
    const response: any = {
      success: true,
      processed: results.length,
      sent: sentCount,
      failed: failedCount,
      results
    };

    // Add debug info if requested
    if (debug) {
      response.debug = {
        testMode: !!(testDays || testOverdue || sendAll),
        testDays,
        testOverdue,
        sendAll,
        dryRun,
        dateRanges: {
          threeDaysBefore: threeDaysBefore.toISOString(),
          threeDaysBeforeEnd: threeDaysBeforeEnd.toISOString(),
          upcomingDateStart: upcomingDateStart.toISOString(),
          upcomingDateEnd: upcomingDateEnd.toISOString(),
          dueDateStart: dueDateStart.toISOString(),
          dueDateEnd: dueDateEnd.toISOString(),
          testOverdueDate: testOverdueDate?.toISOString(),
          now: now.toISOString()
        },
        foundInvoices: {
          upcoming: upcomingInvoices.length,
          dueToday: dueTodayInvoices.length,
          overdue: overdueInvoices.length,
          totalUnpaid: await prisma.invoice.count({
            where: {
              status: { not: 'paid' },
              NOT: { status: 'cancelled' }
            }
          })
        },
        invoiceDetails: {
          upcoming: upcomingInvoices.map((inv: any) => {
            const dueDate = new Date(inv.dueDate);
            const daysUntilDue = Math.ceil(
              (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
            );
            return {
              id: inv.id,
              invoiceNo: inv.invoiceNo,
              dueDate: inv.dueDate.toISOString(),
              daysUntilDue,
              status: inv.status,
              hasEmail: !!inv.customer?.email,
              customerEmail: inv.customer?.email || null,
              lastReminder: inv.lastReminderSentAt?.toISOString() || null,
              reminderCount: inv.reminderCount || 0,
              willSend: !!inv.customer?.email
            };
          }),
          dueToday: dueTodayInvoices.map((inv: any) => ({
            id: inv.id,
            invoiceNo: inv.invoiceNo,
            dueDate: inv.dueDate.toISOString(),
            status: inv.status,
            hasEmail: !!inv.customer?.email,
            customerEmail: inv.customer?.email || null,
            lastReminder: inv.lastReminderSentAt?.toISOString() || null,
            reminderCount: inv.reminderCount || 0,
            willSend: !!inv.customer?.email
          })),
          overdue: overdueInvoices.map((inv: any) => {
            const dueDate = new Date(inv.dueDate);
            const daysOverdue = Math.ceil(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );
            const invoiceWithReminders = inv as any;
            const daysSinceLastReminder =
              invoiceWithReminders.lastReminderSentAt
                ? Math.ceil(
                    (now.getTime() -
                      new Date(
                        invoiceWithReminders.lastReminderSentAt
                      ).getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : 999;
            const willSend =
              !!inv.customer?.email &&
              (sendAll
                ? daysSinceLastReminder >= 3 ||
                  !invoiceWithReminders.lastReminderSentAt
                : true);
            return {
              id: inv.id,
              invoiceNo: inv.invoiceNo,
              dueDate: inv.dueDate.toISOString(),
              daysOverdue,
              status: inv.status,
              hasEmail: !!inv.customer?.email,
              customerEmail: inv.customer?.email || null,
              lastReminder: inv.lastReminderSentAt?.toISOString() || null,
              daysSinceLastReminder: invoiceWithReminders.lastReminderSentAt
                ? daysSinceLastReminder
                : null,
              reminderCount: inv.reminderCount || 0,
              willSend
            };
          })
        }
      };
    }

    if (dryRun) {
      response.dryRun = true;
      response.message =
        'Dry run mode - no emails were actually sent, no database updates made';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing reminders:', error);
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    );
  }
}

async function sendReminderForInvoice(
  invoice: any,
  baseUrl: string,
  reminderType: 'upcoming' | 'overdue' | 'final',
  daysUntilDue?: number,
  daysOverdue?: number,
  dryRun: boolean = false
) {
  try {
    // In dry run mode, skip actual sending
    if (dryRun) {
      return {
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
        status: 'sent' as const,
        reminderType,
        dryRun: true
      };
    }
    // Generate share token if it doesn't exist
    let shareToken = invoice.shareToken;
    if (!shareToken) {
      shareToken = randomBytes(32).toString('base64url');
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: { shareToken }
      });
    }

    // Calculate totals
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
    // Custom tax from invoice taxes
    const customTax =
      (invoice as any).invoiceTaxes?.reduce(
        (sum: number, tax: any) => sum + tax.amount,
        0
      ) || 0;
    const total = subtotal + manualTax + customTax;
    const totalPaid = invoice.payments.reduce(
      (sum: number, p: any) => sum + p.amount,
      0
    );
    const remainingBalance = total - totalPaid;

    const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;
    const pdfUrl = `${baseUrl}/api/invoices/${invoice.id}/pdf`;

    // Send reminder email
    const emailResult = await sendPaymentReminderEmail({
      to: invoice.customer.email,
      customerName: invoice.customer.name,
      invoiceNo: invoice.invoiceNo,
      invoiceUrl,
      pdfUrl,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      total: remainingBalance > 0 ? remainingBalance : total,
      daysUntilDue,
      daysOverdue,
      organizationName: invoice.organization?.name,
      reminderType
    });

    // Log the email
    await prisma.emailLog.create({
      data: {
        invoiceId: invoice.id,
        emailType: 'payment_reminder',
        recipient: invoice.customer.email,
        status: 'sent',
        resendId: emailResult.id || null
      }
    });

    // Update invoice reminder tracking
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        lastReminderSentAt: new Date(),
        reminderCount: { increment: 1 },
        // Mark as overdue if past due date
        ...(daysOverdue &&
          invoice.status !== 'overdue' && {
            status: 'overdue',
            markedOverdueAt: (invoice as any).markedOverdueAt || new Date()
          })
      } as any
    });

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      status: 'sent' as const,
      reminderType
    };
  } catch (error) {
    console.error(`Error sending reminder for invoice ${invoice.id}:`, error);

    // Log failed attempt
    if (invoice.customer.email) {
      await prisma.emailLog.create({
        data: {
          invoiceId: invoice.id,
          emailType: 'payment_reminder',
          recipient: invoice.customer.email,
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }

    return {
      invoiceId: invoice.id,
      invoiceNo: invoice.invoiceNo,
      status: 'failed' as const,
      reminderType
    };
  }
}

async function markOverdueInvoices() {
  const now = new Date();

  // Mark invoices as overdue if they're past due date and not paid
  await prisma.invoice.updateMany({
    where: {
      status: { in: ['sent', 'draft'] },
      dueDate: { lt: now }
    },
    data: {
      status: 'overdue',
      markedOverdueAt: new Date()
    } as any
  });
}
