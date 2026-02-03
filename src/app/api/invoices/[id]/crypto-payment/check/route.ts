import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  checkBlockchainTransactions,
  getTransactionDetails,
  isTestMode,
  isTestnetEnabled
} from '@/lib/crypto/blockchain-monitor';

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
      transactionHash: providedTxHash
    } = body;

    if (!cryptoPaymentId) {
      return NextResponse.json(
        { error: 'Crypto payment ID is required' },
        { status: 400 }
      );
    }

    // Get crypto payment
    const cryptoPayment = await prisma.cryptoPayment.findFirst({
      where: {
        id: cryptoPaymentId,
        payment: {
          invoiceId: invoiceId
        }
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
    const transactions = await checkBlockchainTransactions(
      cryptoPayment.cryptocurrencyCode,
      cryptoPayment.address,
      cryptoPayment.amount,
      cryptoPayment.expiresAt
    );

    if (transactions.length > 0) {
      // Use provided transaction hash if available, otherwise use first transaction
      const txHash =
        providedTxHash || transactions[0].hash || transactions[0].txid;

      // Get transaction details
      const txDetails = await getTransactionDetails(
        cryptoPayment.cryptocurrencyCode,
        txHash
      );

      if (txDetails) {
        const receivedAmount = parseFloat(txDetails.amount);
        const expectedAmount = parseFloat(cryptoPayment.amount.toString());

        // Check if underpaid (allow 1% tolerance for exchange rate fluctuations)
        const tolerance = expectedAmount * 0.01;
        const isUnderpaid = receivedAmount < expectedAmount - tolerance;

        if (isUnderpaid) {
          await prisma.cryptoPayment.update({
            where: { id: cryptoPaymentId },
            data: {
              status: 'underpaid',
              transactionHash: txHash,
              receivedAmount: receivedAmount.toString(),
              confirmations: txDetails.confirmations || 0
            }
          });

          return NextResponse.json({
            status: 'underpaid',
            confirmed: false,
            confirmations: txDetails.confirmations || 0,
            minConfirmations: cryptoPayment.minConfirmations,
            transactionHash: txHash,
            testMode: isTestMode(),
            testnet: isTestnetEnabled()
          });
        }

        // Check confirmations
        const confirmations = txDetails.confirmations || 0;
        const isConfirmed = confirmations >= cryptoPayment.minConfirmations;

        if (isConfirmed) {
          // Calculate fiat amount based on actual received crypto amount
          const actualFiatAmount = receivedAmount * cryptoPayment.exchangeRate;

          // Update crypto payment
          await prisma.cryptoPayment.update({
            where: { id: cryptoPaymentId },
            data: {
              status: 'confirmed',
              transactionHash: txHash,
              receivedAmount: receivedAmount.toString(),
              confirmations,
              fiatAmount: actualFiatAmount
            }
          });

          // Update payment amount
          await prisma.payment.update({
            where: { id: cryptoPayment.paymentId },
            data: {
              amount: actualFiatAmount,
              notes: `Crypto payment confirmed: ${receivedAmount} ${cryptoPayment.cryptocurrencyCode.toUpperCase()} - Transaction: ${txHash}`
            }
          });

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
          await prisma.cryptoPayment.update({
            where: { id: cryptoPaymentId },
            data: {
              transactionHash: txHash,
              receivedAmount: receivedAmount.toString(),
              confirmations
            }
          });

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
      }
    }

    // No transactions found yet
    return NextResponse.json({
      status: 'pending',
      confirmed: false,
      confirmations: cryptoPayment.confirmations || 0,
      minConfirmations: cryptoPayment.minConfirmations,
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
