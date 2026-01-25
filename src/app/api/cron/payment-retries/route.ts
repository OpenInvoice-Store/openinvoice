import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { randomBytes } from 'crypto';

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

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    if (!verifyCronSecret(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    const searchParams = request.nextUrl.searchParams;
    const debug = searchParams.get('debug') === 'true';
    const dryRun = searchParams.get('dryRun') === 'true';

    // Find payments that need retrying
    // - Status is 'failed'
    // - retryStatus is 'scheduled'
    // - nextRetryAt is in the past or null
    // - retryCount < maxRetries (we'll check this in code)
    const allFailedPayments = await prisma.payment.findMany({
      where: {
        stripeStatus: 'failed',
        retryStatus: 'scheduled',
        OR: [{ nextRetryAt: { lte: now } }, { nextRetryAt: null }]
      },
      include: {
        invoice: {
          include: {
            customer: true,
            organization: true,
            items: true,
            payments: true
          }
        }
      }
    });

    // Filter to only include payments that haven't exceeded max retries
    const paymentsToRetry = allFailedPayments.filter(
      (p: any) => (p.retryCount || 0) < (p.maxRetries || 3)
    );

    let retriedCount = 0;
    let succeededCount = 0;
    let failedCount = 0;
    const results: Array<{
      paymentId: string;
      invoiceId: string;
      invoiceNo: number;
      status: 'succeeded' | 'failed' | 'skipped';
      retryAttempt: number;
      reason?: string;
    }> = [];

    for (const payment of paymentsToRetry) {
      try {
        // Skip if invoice is already paid
        const totalAmount = payment.invoice.items.reduce(
          (sum, item) =>
            sum + item.price * item.quantity * (1 + item.taxRate / 100),
          0
        );
        const totalPaid = payment.invoice.payments
          .filter((p) => p.stripeStatus === 'succeeded')
          .reduce((sum, p) => sum + p.amount, 0);

        if (totalPaid >= totalAmount) {
          // Invoice is already paid, mark retry as exhausted
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              retryStatus: 'exhausted',
              notes: payment.notes
                ? `${payment.notes}\nSkipped: Invoice already paid`
                : 'Skipped: Invoice already paid'
            } as any
          });
          results.push({
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            invoiceNo: payment.invoice.invoiceNo,
            status: 'skipped',
            retryAttempt: payment.retryCount + 1,
            reason: 'Invoice already paid'
          });
          continue;
        }

        // Skip if no Stripe customer ID
        if (!payment.stripeCustomerId) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              retryStatus: 'exhausted',
              notes: payment.notes
                ? `${payment.notes}\nSkipped: No saved payment method`
                : 'Skipped: No saved payment method'
            } as any
          });
          results.push({
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            invoiceNo: payment.invoice.invoiceNo,
            status: 'skipped',
            retryAttempt: payment.retryCount + 1,
            reason: 'No saved payment method'
          });
          continue;
        }

        // Skip if organization doesn't have Stripe Connect enabled
        if (
          !payment.invoice.organization.stripeAccountId ||
          payment.invoice.organization.stripeAccountStatus !== 'active'
        ) {
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              retryStatus: 'exhausted',
              notes: payment.notes
                ? `${payment.notes}\nSkipped: Stripe Connect not active`
                : 'Skipped: Stripe Connect not active'
            } as any
          });
          results.push({
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            invoiceNo: payment.invoice.invoiceNo,
            status: 'skipped',
            retryAttempt: payment.retryCount + 1,
            reason: 'Stripe Connect not active'
          });
          continue;
        }

        if (dryRun) {
          results.push({
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            invoiceNo: payment.invoice.invoiceNo,
            status: 'skipped',
            retryAttempt: payment.retryCount + 1,
            reason: 'Dry run mode'
          });
          continue;
        }

        retriedCount++;

        // Calculate amount to charge (remaining balance or original amount)
        const remainingBalance = totalAmount - totalPaid;
        const amountToCharge = Math.min(remainingBalance, payment.amount);
        const amountInCents = Math.round(amountToCharge * 100);

        // Get customer's payment methods
        const paymentMethods = await stripe.paymentMethods.list({
          customer: payment.stripeCustomerId,
          type: 'card'
        });

        if (paymentMethods.data.length === 0) {
          // No payment methods available
          await prisma.payment.update({
            where: { id: payment.id },
            data: {
              retryStatus: 'exhausted',
              notes: payment.notes
                ? `${payment.notes}\nRetry failed: No payment methods available`
                : 'Retry failed: No payment methods available'
            } as any
          });
          failedCount++;
          results.push({
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            invoiceNo: payment.invoice.invoiceNo,
            status: 'failed',
            retryAttempt: payment.retryCount + 1,
            reason: 'No payment methods available'
          });
          continue;
        }

        // Use the first available payment method
        const paymentMethod = paymentMethods.data[0];

        // Create a new payment intent for retry
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: amountInCents,
            currency: 'usd',
            customer: payment.stripeCustomerId,
            payment_method: paymentMethod.id,
            confirmation_method: 'automatic',
            confirm: true,
            metadata: {
              invoiceId: payment.invoiceId,
              organizationId: payment.invoice.organizationId,
              retryAttempt: String(payment.retryCount + 1),
              originalPaymentIntentId: payment.stripePaymentIntentId || ''
            },
            application_fee_amount: payment.invoice.organization.stripeAccountId
              ? Math.round(amountInCents * 0.02) // 2% platform fee
              : undefined,
            on_behalf_of:
              payment.invoice.organization.stripeAccountId || undefined,
            transfer_data: payment.invoice.organization.stripeAccountId
              ? {
                  destination: payment.invoice.organization.stripeAccountId
                }
              : undefined
          },
          {
            stripeAccount:
              payment.invoice.organization.stripeAccountId || undefined
          }
        );

        // Update payment record with retry attempt
        const newRetryCount = payment.retryCount + 1;
        const retryIntervals = [1, 6, 24]; // hours
        const nextRetryHours =
          retryIntervals[Math.min(newRetryCount, retryIntervals.length - 1)];
        const nextRetryAt = new Date();
        nextRetryAt.setHours(nextRetryAt.getHours() + nextRetryHours);
        const shouldRetryAgain = newRetryCount < (payment.maxRetries || 3);

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            retryCount: newRetryCount,
            lastRetryAt: new Date(),
            nextRetryAt: shouldRetryAgain ? nextRetryAt : null,
            retryStatus: shouldRetryAgain ? 'scheduled' : 'exhausted',
            notes: payment.notes
              ? `${payment.notes}\nRetry ${newRetryCount}: New PaymentIntent ${paymentIntent.id}`
              : `Retry ${newRetryCount}: New PaymentIntent ${paymentIntent.id}`
          } as any
        });

        // If payment succeeded immediately, handle it
        if (paymentIntent.status === 'succeeded') {
          succeededCount++;
          results.push({
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            invoiceNo: payment.invoice.invoiceNo,
            status: 'succeeded',
            retryAttempt: newRetryCount
          });
        } else {
          // Payment is processing or requires action
          // The webhook will handle the final status
          results.push({
            paymentId: payment.id,
            invoiceId: payment.invoiceId,
            invoiceNo: payment.invoice.invoiceNo,
            status:
              paymentIntent.status === 'requires_action' ? 'failed' : 'failed',
            retryAttempt: newRetryCount,
            reason: `PaymentIntent status: ${paymentIntent.status}`
          });
        }
      } catch (error) {
        console.error(`Error retrying payment ${payment.id}:`, error);
        failedCount++;

        // Update retry status
        const newRetryCount = payment.retryCount + 1;
        const retryIntervals = [1, 6, 24]; // hours
        const nextRetryHours =
          retryIntervals[Math.min(newRetryCount, retryIntervals.length - 1)];
        const nextRetryAt = new Date();
        nextRetryAt.setHours(nextRetryAt.getHours() + nextRetryHours);
        const shouldRetryAgain = newRetryCount < (payment.maxRetries || 3);

        await prisma.payment.update({
          where: { id: payment.id },
          data: {
            retryCount: newRetryCount,
            lastRetryAt: new Date(),
            nextRetryAt: shouldRetryAgain ? nextRetryAt : null,
            retryStatus: shouldRetryAgain ? 'scheduled' : 'exhausted',
            notes: payment.notes
              ? `${payment.notes}\nRetry ${newRetryCount} error: ${error instanceof Error ? error.message : 'Unknown error'}`
              : `Retry ${newRetryCount} error: ${error instanceof Error ? error.message : 'Unknown error'}`
          } as any
        });

        results.push({
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          invoiceNo: payment.invoice.invoiceNo,
          status: 'failed',
          retryAttempt: newRetryCount,
          reason: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const response: any = {
      success: true,
      processed: retriedCount,
      succeeded: succeededCount,
      failed: failedCount,
      skipped: results.filter((r) => r.status === 'skipped').length,
      results
    };

    if (debug) {
      response.debug = {
        foundPayments: paymentsToRetry.length,
        dateRanges: {
          now: now.toISOString()
        },
        paymentDetails: paymentsToRetry.map((p: any) => ({
          id: p.id,
          invoiceId: p.invoiceId,
          invoiceNo: p.invoice.invoiceNo,
          amount: p.amount,
          retryCount: p.retryCount,
          maxRetries: p.maxRetries,
          nextRetryAt: p.nextRetryAt?.toISOString() || null,
          retryStatus: p.retryStatus,
          stripeCustomerId: p.stripeCustomerId,
          hasPaymentMethods: !!p.stripeCustomerId
        }))
      };
    }

    if (dryRun) {
      response.dryRun = true;
      response.message = 'Dry run mode - no payments were actually retried';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error processing payment retries:', error);
    return NextResponse.json(
      { error: 'Failed to process payment retries' },
      { status: 500 }
    );
  }
}
