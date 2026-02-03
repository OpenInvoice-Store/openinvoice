import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import {
  checkBlockchainTransactions,
  getTransactionDetails,
  getExplorerUrl,
  isTestMode,
  isTestnetEnabled
} from '@/lib/crypto/blockchain-monitor';
import { applyPaymentToInstallments } from '@/lib/payment-plan';
import {
  updateInvoiceStatusFromPaymentPlan,
  updateRegularInvoiceStatus
} from '@/lib/payment-plan';
import { sendPaymentConfirmationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      paymentId,
      actualCryptoAmount,
      transactionHash: providedTxHash
    } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Get crypto payment
    const cryptoPayment = await prisma.cryptoPayment.findFirst({
      where: {
        id: paymentId,
        organizationId: orgId
      },
      include: {
        payment: {
          include: {
            invoice: {
              include: {
                customer: true,
                organization: true,
                items: true,
                payments: true,
                paymentPlan: true
              }
            }
          }
        }
      }
    });

    if (!cryptoPayment) {
      return NextResponse.json(
        { error: 'Crypto payment not found' },
        { status: 404 }
      );
    }

    // Check if expired
    if (new Date() > cryptoPayment.expiresAt) {
      await prisma.cryptoPayment.update({
        where: { id: paymentId },
        data: { status: 'expired' }
      });

      return NextResponse.json({
        status: 'expired',
        confirmed: false,
        confirmations: 0,
        minConfirmations: cryptoPayment.minConfirmations,
        testMode: isTestMode()
      });
    }

    // If already confirmed, return status
    if (cryptoPayment.status === 'confirmed') {
      return NextResponse.json({
        status: 'confirmed',
        confirmed: true,
        confirmations: cryptoPayment.confirmations,
        minConfirmations: cryptoPayment.minConfirmations,
        transactionHash: cryptoPayment.transactionHash,
        testMode: isTestMode(),
        testnet: isTestnetEnabled()
      });
    }

    // Check blockchain for transactions
    const sinceTimestamp = cryptoPayment.createdAt;
    const isTestnet = isTestnetEnabled();

    let transaction: any = null;
    let txDetails: any = null;
    let actualReceivedAmount: number;

    // If actual amount provided from WebSocket, use it directly
    if (actualCryptoAmount && providedTxHash) {
      console.log('[CRYPTO] Using actual transaction data from WebSocket:', {
        hash: providedTxHash,
        actualAmount: actualCryptoAmount
      });

      actualReceivedAmount = parseFloat(String(actualCryptoAmount));

      // Get transaction details for confirmations
      try {
        txDetails = await getTransactionDetails(
          cryptoPayment.cryptocurrencyCode,
          providedTxHash,
          isTestnet
        );

        if (!txDetails) {
          // Create minimal transaction details if not found
          txDetails = {
            hash: providedTxHash,
            amount: actualReceivedAmount.toString(),
            confirmations: 1, // XRP confirms quickly
            blockHeight: undefined
          };
        }
      } catch (error: any) {
        console.warn(
          '[CRYPTO] Could not fetch transaction details, using WebSocket data:',
          error
        );
        txDetails = {
          hash: providedTxHash,
          amount: actualReceivedAmount.toString(),
          confirmations: 1,
          blockHeight: undefined
        };
      }

      transaction = {
        hash: providedTxHash,
        amount: actualReceivedAmount.toString()
      };
    } else {
      // Normal flow: fetch from blockchain
      try {
        transaction = await checkBlockchainTransactions(
          cryptoPayment.cryptocurrencyCode,
          cryptoPayment.address,
          cryptoPayment.amount,
          sinceTimestamp
        );

        if (!transaction) {
          // No transaction found yet
          return NextResponse.json({
            status: 'pending',
            confirmed: false,
            confirmations: 0,
            minConfirmations: cryptoPayment.minConfirmations,
            testMode: isTestMode(),
            testnet: isTestnet
          });
        }

        // Transaction found - get full details
        txDetails = await getTransactionDetails(
          cryptoPayment.cryptocurrencyCode,
          transaction.hash,
          isTestnet
        );

        if (!txDetails) {
          // Use transaction data if details unavailable
          txDetails = transaction;
        }

        actualReceivedAmount = parseFloat(txDetails.amount);
      } catch (error: any) {
        console.error('Error checking blockchain:', error);
        return NextResponse.json({
          status: 'pending',
          confirmed: false,
          confirmations: 0,
          minConfirmations: cryptoPayment.minConfirmations,
          error: error.message,
          testMode: isTestMode()
        });
      }
    }

    // Check if amount matches (with tolerance)
    const expectedAmount = parseFloat(cryptoPayment.amount);
    const tolerance = 0.01; // 1% tolerance

    const isUnderpaid = actualReceivedAmount < expectedAmount * (1 - tolerance);

    console.log(`[CRYPTO] Payment check result:`, {
      paymentId: cryptoPayment.id,
      status: cryptoPayment.status,
      expectedAmount,
      actualReceivedAmount,
      confirmations: txDetails.confirmations,
      minConfirmations: cryptoPayment.minConfirmations,
      isUnderpaid,
      testMode: isTestMode(),
      testnet: isTestnet,
      fromWebSocket: !!actualCryptoAmount
    });

    // Calculate actual fiat amount from actual crypto amount received
    // Use the exchange rate from when payment was created
    const actualFiatAmount = cryptoPayment.exchangeRate
      ? actualReceivedAmount * cryptoPayment.exchangeRate
      : cryptoPayment.fiatAmount; // Fallback to original if no exchange rate

    // For XRP, 1 confirmation is sufficient since transactions finalize in 3-5 seconds
    // Once a transaction is in a validated ledger, it's final
    const isXRP = cryptoPayment.cryptocurrencyCode.toLowerCase() === 'xrp';
    const effectiveMinConfirmations = isXRP
      ? Math.min(cryptoPayment.minConfirmations, 1) // XRP only needs 1 confirmation
      : cryptoPayment.minConfirmations;

    const hasEnoughConfirmations =
      txDetails.confirmations >= effectiveMinConfirmations;

    // Update crypto payment with ACTUAL transaction details
    const updatedCryptoPayment = await prisma.cryptoPayment.update({
      where: { id: paymentId },
      data: {
        transactionHash: transaction.hash,
        amount: actualReceivedAmount.toString(), // Update with ACTUAL crypto amount received
        confirmations: txDetails.confirmations,
        status: hasEnoughConfirmations
          ? isUnderpaid
            ? 'underpaid'
            : 'confirmed'
          : 'pending',
        // Update fiat amount to reflect actual payment
        fiatAmount: actualFiatAmount // Actual fiat amount received
        // expectedFiatAmount remains unchanged (set during creation)
      }
    });

    // Always update payment record with ACTUAL amount received (even if pending)
    // This ensures the payment amount reflects what was actually received on the blockchain
    // Keep expectedAmount unchanged so we can compare expected vs actual
    const expectedFiatAmount =
      (cryptoPayment as any).expectedFiatAmount || cryptoPayment.fiatAmount;
    const paymentStatusText = hasEnoughConfirmations
      ? isUnderpaid
        ? 'UNDERPAID'
        : 'confirmed'
      : 'pending';

    await prisma.payment.update({
      where: { id: cryptoPayment.paymentId },
      data: {
        amount: actualFiatAmount, // Actual fiat amount based on received crypto
        // expectedAmount remains unchanged (set during creation)
        date: new Date(), // Update date to when transaction was detected
        notes: hasEnoughConfirmations
          ? isUnderpaid
            ? `Crypto payment UNDERPAID: Received ${actualReceivedAmount} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} (${actualFiatAmount.toFixed(2)} ${cryptoPayment.fiatCurrency}) - Expected: ${expectedFiatAmount.toFixed(2)} ${cryptoPayment.fiatCurrency} - Shortfall: ${(expectedFiatAmount - actualFiatAmount).toFixed(2)} ${cryptoPayment.fiatCurrency} - ${transaction.hash}`
            : `Crypto payment confirmed: ${actualReceivedAmount} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} (${actualFiatAmount.toFixed(2)} ${cryptoPayment.fiatCurrency}) - Expected: ${expectedFiatAmount.toFixed(2)} ${cryptoPayment.fiatCurrency} - ${transaction.hash}`
          : `Crypto payment pending: ${actualReceivedAmount} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} (${actualFiatAmount.toFixed(2)} ${cryptoPayment.fiatCurrency}) - Expected: ${expectedFiatAmount.toFixed(2)} ${cryptoPayment.fiatCurrency} - ${transaction.hash} - ${txDetails.confirmations}/${cryptoPayment.minConfirmations} confirmations`
      }
    });

    // Update invoice status whenever a payment is detected (even if pending or underpaid)
    // This ensures draft invoices are marked as "sent" when payment is received
    // For underpaid payments: invoice stays "sent" (not "paid") until fully paid
    if (cryptoPayment.payment.invoice.paymentPlan) {
      // For payment plan invoices, update when confirmed OR underpaid
      if (
        updatedCryptoPayment.status === 'confirmed' ||
        updatedCryptoPayment.status === 'underpaid'
      ) {
        // Apply to installments if payment plan exists (use actual amount received)
        await applyPaymentToInstallments(
          cryptoPayment.payment.invoiceId,
          cryptoPayment.paymentId,
          actualFiatAmount // Use actual fiat amount received (even if underpaid)
        );
        // Update invoice status for payment plan invoices
        // This will mark as "sent" if draft, or "paid" if fully paid
        await updateInvoiceStatusFromPaymentPlan(
          cryptoPayment.payment.invoiceId
        );
      }
    } else {
      // For regular invoices, update status whenever payment is detected
      // This will change "draft" to "sent" if payment > 0, or to "paid" if fully paid
      // Underpaid payments will keep invoice as "sent" (not "paid") until balance is cleared
      await updateRegularInvoiceStatus(cryptoPayment.payment.invoiceId);
    }

    // Send notifications for confirmed payments (not for underpaid - those need manual review)
    // Underpaid payments should be reviewed before sending confirmation
    if (
      updatedCryptoPayment.status === 'confirmed' &&
      cryptoPayment.payment.invoice.status !== 'paid'
    ) {
      // Send confirmation email only for fully confirmed payments
      const invoice = cryptoPayment.payment.invoice;
      if (invoice.customer.email) {
        try {
          // Generate share token if needed
          let shareToken = invoice.shareToken;
          if (!shareToken) {
            const { randomBytes } = await import('crypto');
            shareToken = randomBytes(32).toString('base64url');
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { shareToken }
            });
          }

          const baseUrl = request.nextUrl.origin;
          const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;

          await sendPaymentConfirmationEmail({
            to: invoice.customer.email,
            customerName: invoice.customer.name,
            invoiceNo: invoice.invoiceNo,
            invoiceUrl,
            amount: actualFiatAmount, // Use actual amount received
            paymentDate: new Date(),
            organizationName: invoice.organization?.name,
            organizationId: orgId
          });
        } catch (emailError) {
          console.error(
            'Error sending payment confirmation email:',
            emailError
          );
        }
      }
    }

    // Log underpaid payment for manual review
    if (updatedCryptoPayment.status === 'underpaid') {
      console.warn(
        `[CRYPTO] Underpaid payment detected - requires manual review:`,
        {
          paymentId: cryptoPayment.paymentId,
          invoiceId: cryptoPayment.payment.invoiceId,
          expectedAmount: expectedFiatAmount,
          actualAmount: actualFiatAmount,
          shortfall: expectedFiatAmount - actualFiatAmount,
          transactionHash: transaction.hash
        }
      );
    }

    return NextResponse.json({
      status: updatedCryptoPayment.status,
      confirmed:
        updatedCryptoPayment.status === 'confirmed' ||
        updatedCryptoPayment.status === 'underpaid',
      confirmations: updatedCryptoPayment.confirmations,
      minConfirmations: updatedCryptoPayment.minConfirmations,
      transactionHash: updatedCryptoPayment.transactionHash,
      underpaid: updatedCryptoPayment.status === 'underpaid',
      testMode: isTestMode(),
      testnet: isTestnet
    });
  } catch (error: any) {
    console.error('Error checking crypto payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check crypto payment' },
      { status: 500 }
    );
  }
}
