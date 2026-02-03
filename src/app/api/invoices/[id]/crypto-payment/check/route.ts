import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  checkBlockchainTransactions,
  getTransactionDetails,
  isTestMode,
  isTestnetEnabled
} from '@/lib/crypto/blockchain-monitor';
import { applyPaymentToInstallments } from '@/lib/payment-plan';
import {
  updateInvoiceStatusFromPaymentPlan,
  updateRegularInvoiceStatus
} from '@/lib/payment-plan';
import { sendPaymentConfirmationEmail } from '@/lib/email';

/**
 * Public endpoint to check crypto payment status for an invoice
 * Used by public invoice view to check payment status without auth
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const body = await request.json();
    const {
      cryptoPaymentId,
      actualCryptoAmount,
      transactionHash: providedTxHash,
      destinationTag: providedDestinationTag
    } = body;

    console.log('[CRYPTO CHECK] Received request:', {
      invoiceId,
      cryptoPaymentId,
      actualCryptoAmount,
      providedTxHash,
      providedDestinationTag
    });

    // Get crypto payment
    // If destination tag is provided, use it for matching (XRP payment identification)
    // This allows matching payments even if multiple invoices use the same address
    const whereClause: any = {
      payment: {
        invoiceId: invoiceId
      }
    };

    if (cryptoPaymentId) {
      whereClause.id = cryptoPaymentId;
    } else if (providedDestinationTag !== undefined && providedTxHash) {
      // If no cryptoPaymentId but we have destination tag and transaction hash,
      // find payment by destination tag (for WebSocket auto-matching)
      whereClause.destinationTag = providedDestinationTag;
      whereClause.status = 'pending';
      whereClause.expiresAt = { gt: new Date() };
    } else {
      return NextResponse.json(
        { error: 'Crypto payment ID or destination tag is required' },
        { status: 400 }
      );
    }

    const cryptoPayment = await prisma.cryptoPayment.findFirst({
      where: whereClause,
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

    // Verify destination tag matches if provided (XRP payment identification)
    const paymentDestinationTag = (cryptoPayment as any).destinationTag;
    if (
      providedDestinationTag !== undefined &&
      paymentDestinationTag !== null
    ) {
      if (paymentDestinationTag !== providedDestinationTag) {
        console.warn('[CRYPTO CHECK] Destination tag mismatch:', {
          expected: paymentDestinationTag,
          received: providedDestinationTag,
          cryptoPaymentId: cryptoPayment.id
        });
        return NextResponse.json(
          { error: 'Destination tag mismatch' },
          { status: 400 }
        );
      }
    }

    // Check if expired
    if (new Date() > cryptoPayment.expiresAt) {
      await prisma.cryptoPayment.update({
        where: { id: cryptoPaymentId },
        data: { status: 'expired' }
      });

      return NextResponse.json({
        status: 'expired',
        confirmed: false,
        confirmations: 0,
        minConfirmations: cryptoPayment.minConfirmations,
        testMode: isTestMode(),
        testnet: isTestnetEnabled()
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
        actualAmount: actualCryptoAmount,
        paymentId: cryptoPaymentId
      });

      actualReceivedAmount = parseFloat(String(actualCryptoAmount));

      // Get transaction details for confirmations
      const isXRP = cryptoPayment.cryptocurrencyCode.toLowerCase() === 'xrp';

      try {
        txDetails = await getTransactionDetails(
          cryptoPayment.cryptocurrencyCode,
          providedTxHash,
          isTestnet
        );

        // For XRP, if transaction details don't have confirmations but transaction is validated,
        // it means it's confirmed (XRP transactions are final once in validated ledger)
        if (
          txDetails &&
          isXRP &&
          (!txDetails.confirmations || txDetails.confirmations === 0)
        ) {
          txDetails.confirmations = 1;
          console.log(
            '[CRYPTO CHECK] XRP transaction validated, setting confirmations to 1'
          );
        }

        if (!txDetails) {
          // Create minimal transaction details if not found
          // For XRP, if transaction is validated (from WebSocket), it has at least 1 confirmation
          // XRP transactions finalize in 3-5 seconds and are final once in a validated ledger
          txDetails = {
            hash: providedTxHash,
            amount: actualReceivedAmount.toString(),
            confirmations: isXRP ? 1 : 0, // XRP confirms quickly, other cryptos need more
            blockHeight: undefined
          };
        }
      } catch (error: any) {
        console.warn(
          '[CRYPTO] Could not fetch transaction details, using WebSocket data:',
          error
        );
        // For XRP, if transaction is validated (from WebSocket), it has at least 1 confirmation
        txDetails = {
          hash: providedTxHash,
          amount: actualReceivedAmount.toString(),
          confirmations: isXRP ? 1 : 0,
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
    const expectedAmount = parseFloat(cryptoPayment.amount.toString());
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
    const actualFiatAmount = cryptoPayment.exchangeRate
      ? actualReceivedAmount * cryptoPayment.exchangeRate
      : cryptoPayment.fiatAmount; // Fallback to original if no exchange rate

    // Check confirmations
    const confirmations = txDetails.confirmations || 0;

    // For XRP, 1 confirmation is sufficient since transactions finalize in 3-5 seconds
    // Once a transaction is in a validated ledger, it's final
    const isXRP = cryptoPayment.cryptocurrencyCode.toLowerCase() === 'xrp';
    const effectiveMinConfirmations = isXRP
      ? Math.min(cryptoPayment.minConfirmations, 1) // XRP only needs 1 confirmation
      : cryptoPayment.minConfirmations;

    const isConfirmed = confirmations >= effectiveMinConfirmations;

    console.log('[CRYPTO CHECK] Confirmation check:', {
      cryptocurrency: cryptoPayment.cryptocurrencyCode,
      isXRP,
      confirmations,
      minConfirmations: cryptoPayment.minConfirmations,
      effectiveMinConfirmations,
      isConfirmed
    });

    // Use provided transaction hash if available, otherwise use transaction hash
    const txHash = providedTxHash || transaction.hash;

    if (isUnderpaid) {
      console.log('[CRYPTO CHECK] Payment underpaid, updating records:', {
        cryptoPaymentId,
        txHash,
        expectedAmount,
        actualReceivedAmount,
        actualFiatAmount,
        confirmations,
        shortfall: expectedAmount - actualReceivedAmount
      });

      // Update crypto payment
      const updatedCryptoPayment = await prisma.cryptoPayment.update({
        where: { id: cryptoPaymentId },
        data: {
          status: 'underpaid',
          transactionHash: txHash,
          amount: actualReceivedAmount.toString(), // Update with actual crypto amount received
          confirmations,
          fiatAmount: actualFiatAmount
        }
      });

      console.log(
        '[CRYPTO CHECK] Crypto payment updated (underpaid):',
        updatedCryptoPayment.id
      );

      // Update payment record with actual amount received (even if underpaid)
      // This ensures the payment shows up in the system
      const expectedFiatAmount = cryptoPayment.exchangeRate
        ? expectedAmount * cryptoPayment.exchangeRate
        : cryptoPayment.fiatAmount;

      const updatedPayment = await prisma.payment.update({
        where: { id: cryptoPayment.paymentId },
        data: {
          amount: actualFiatAmount, // Actual amount received (less than expected)
          notes: `Crypto payment UNDERPAID: Received ${actualReceivedAmount} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} (${actualFiatAmount.toFixed(2)} ${cryptoPayment.fiatCurrency}) - Expected: ${expectedAmount} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} (${expectedFiatAmount.toFixed(2)} ${cryptoPayment.fiatCurrency}) - Shortfall: ${(expectedAmount - actualReceivedAmount).toFixed(6)} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} (${(expectedFiatAmount - actualFiatAmount).toFixed(2)} ${cryptoPayment.fiatCurrency}) - Transaction: ${txHash}`
        }
      });

      console.log('[CRYPTO CHECK] Payment updated (underpaid):', {
        paymentId: updatedPayment.id,
        amount: updatedPayment.amount,
        expectedAmount: expectedFiatAmount
      });

      // Apply payment to installments if payment plan exists (use actual amount received)
      if (cryptoPayment.payment.invoice.paymentPlan) {
        await applyPaymentToInstallments(
          cryptoPayment.payment.invoice.id,
          cryptoPayment.payment.id,
          actualFiatAmount // Use actual fiat amount received (even if underpaid)
        );
        await updateInvoiceStatusFromPaymentPlan(
          cryptoPayment.payment.invoice.id
        );
      } else {
        // Update regular invoice status (will mark as "sent" not "paid" since underpaid)
        await updateRegularInvoiceStatus(cryptoPayment.payment.invoice.id);
      }

      return NextResponse.json({
        status: 'underpaid',
        confirmed: false,
        confirmations,
        minConfirmations: cryptoPayment.minConfirmations,
        transactionHash: txHash,
        expectedAmount: expectedAmount.toString(),
        actualAmount: actualReceivedAmount.toString(),
        shortfall: (expectedAmount - actualReceivedAmount).toString(),
        testMode: isTestMode(),
        testnet: isTestnetEnabled()
      });
    }

    if (isConfirmed) {
      console.log('[CRYPTO CHECK] Payment confirmed, updating records:', {
        cryptoPaymentId,
        txHash,
        actualReceivedAmount,
        actualFiatAmount,
        confirmations
      });

      // Update crypto payment
      const updatedCryptoPayment = await prisma.cryptoPayment.update({
        where: { id: cryptoPaymentId },
        data: {
          status: 'confirmed',
          transactionHash: txHash,
          amount: actualReceivedAmount.toString(), // Update with actual crypto amount received
          confirmations,
          fiatAmount: actualFiatAmount
        }
      });

      console.log(
        '[CRYPTO CHECK] Crypto payment updated:',
        updatedCryptoPayment.id
      );

      // Update payment amount
      const updatedPayment = await prisma.payment.update({
        where: { id: cryptoPayment.paymentId },
        data: {
          amount: actualFiatAmount,
          notes: `Crypto payment confirmed: ${actualReceivedAmount} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} - Transaction: ${txHash}`
        }
      });

      console.log('[CRYPTO CHECK] Payment updated:', {
        paymentId: updatedPayment.id,
        amount: updatedPayment.amount
      });

      // Apply payment to installments if payment plan exists
      if (cryptoPayment.payment.invoice.paymentPlan) {
        await applyPaymentToInstallments(
          cryptoPayment.payment.invoice.id,
          cryptoPayment.payment.id,
          actualFiatAmount
        );
        await updateInvoiceStatusFromPaymentPlan(
          cryptoPayment.payment.invoice.id
        );
      } else {
        // Update regular invoice status
        await updateRegularInvoiceStatus(cryptoPayment.payment.invoice.id);
      }

      // Send payment confirmation email
      const invoice = cryptoPayment.payment.invoice;
      if (invoice.customer?.email) {
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

          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
          const invoiceUrl = `${baseUrl}/invoice/${shareToken}`;

          await sendPaymentConfirmationEmail({
            to: invoice.customer.email,
            customerName: invoice.customer.name,
            invoiceNo: invoice.invoiceNo,
            invoiceUrl,
            amount: actualFiatAmount,
            paymentDate: new Date(),
            organizationName: invoice.organization?.name,
            organizationId: invoice.organizationId
          });
        } catch (emailError) {
          console.error(
            'Error sending payment confirmation email:',
            emailError
          );
          // Don't fail the request if email fails
        }
      }

      return NextResponse.json({
        status: 'confirmed',
        confirmed: true,
        confirmations,
        minConfirmations: cryptoPayment.minConfirmations,
        transactionHash: txHash,
        testMode: isTestMode(),
        testnet: isTestnetEnabled()
      });
    } else {
      // Update with current confirmations but not yet confirmed
      console.log(
        '[CRYPTO CHECK] Payment pending (not enough confirmations):',
        {
          cryptoPaymentId,
          txHash,
          actualReceivedAmount,
          actualFiatAmount,
          confirmations,
          minConfirmations: cryptoPayment.minConfirmations
        }
      );

      const updatedCryptoPayment = await prisma.cryptoPayment.update({
        where: { id: cryptoPaymentId },
        data: {
          transactionHash: txHash,
          amount: actualReceivedAmount.toString(), // Update with actual crypto amount received
          confirmations,
          fiatAmount: actualFiatAmount
        }
      });

      console.log(
        '[CRYPTO CHECK] Crypto payment updated (pending):',
        updatedCryptoPayment.id
      );

      // Also update the payment record even if not confirmed yet
      // This ensures the payment shows up in the system
      const updatedPayment = await prisma.payment.update({
        where: { id: cryptoPayment.paymentId },
        data: {
          amount: actualFiatAmount, // Update with actual amount received
          notes: `Crypto payment pending: ${actualReceivedAmount} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} - Transaction: ${txHash} - ${confirmations}/${cryptoPayment.minConfirmations} confirmations`
        }
      });

      console.log('[CRYPTO CHECK] Payment updated (pending):', {
        paymentId: updatedPayment.id,
        amount: updatedPayment.amount
      });

      // Update invoice status even for pending payments (so it shows as "sent" instead of "draft")
      if (cryptoPayment.payment.invoice.paymentPlan) {
        await applyPaymentToInstallments(
          cryptoPayment.payment.invoice.id,
          cryptoPayment.payment.id,
          actualFiatAmount
        );
        await updateInvoiceStatusFromPaymentPlan(
          cryptoPayment.payment.invoice.id
        );
      } else {
        await updateRegularInvoiceStatus(cryptoPayment.payment.invoice.id);
      }

      return NextResponse.json({
        status: 'pending',
        confirmed: false,
        confirmations,
        minConfirmations: cryptoPayment.minConfirmations,
        transactionHash: txHash,
        testMode: isTestMode(),
        testnet: isTestnetEnabled()
      });
    }

    // No transactions found yet (should not reach here if WebSocket data was provided)
    // cryptoPayment is guaranteed to be non-null here due to check at line 65
    return NextResponse.json({
      status: 'pending',
      confirmed: false,
      confirmations: cryptoPayment!.confirmations || 0,
      minConfirmations: cryptoPayment!.minConfirmations,
      testMode: isTestMode(),
      testnet: isTestnetEnabled()
    });
  } catch (error: any) {
    console.error('Error checking crypto payment status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check payment status' },
      { status: 500 }
    );
  }
}
