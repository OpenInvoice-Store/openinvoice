import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isTestMode, isTestnetEnabled } from '@/lib/crypto/blockchain-monitor';

/**
 * Public endpoint to get crypto payment data for an invoice
 * Used by public invoice view to restore payment UI after page reload
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const cryptoPaymentId = searchParams.get('cryptoPaymentId');

    // Get invoice to verify it exists
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: {
          select: {
            cryptoPaymentsEnabled: true
          }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // If cryptoPaymentId is provided, get that specific payment
    if (cryptoPaymentId) {
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
              invoice: true
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
        return NextResponse.json({ error: 'Payment expired' }, { status: 400 });
      }

      // Check if already confirmed
      if (cryptoPayment.status === 'confirmed') {
        return NextResponse.json(
          { error: 'Payment already confirmed' },
          { status: 400 }
        );
      }

      // Generate QR code data
      // For XRP, include destination tag in QR code
      const isXRP = cryptoPayment.cryptocurrencyCode.toLowerCase() === 'xrp';
      let qrCodeData = `${cryptoPayment.cryptocurrencyCode}:${cryptoPayment.address}`;
      if (isXRP && cryptoPayment.destinationTag !== null) {
        qrCodeData += `?dt=${cryptoPayment.destinationTag}&amount=${cryptoPayment.amount}`;
      } else {
        qrCodeData += `?amount=${cryptoPayment.amount}`;
      }

      return NextResponse.json({
        paymentId: cryptoPayment.paymentId,
        cryptoPaymentId: cryptoPayment.id,
        cryptocurrency: cryptoPayment.cryptocurrencyCode.toUpperCase(),
        cryptoAmount: cryptoPayment.amount.toString(),
        address: cryptoPayment.address,
        destinationTag: cryptoPayment.destinationTag, // Include destination tag
        qrCode: qrCodeData,
        expiresAt: cryptoPayment.expiresAt.toISOString(),
        minConfirmations: cryptoPayment.minConfirmations,
        exchangeRate: cryptoPayment.exchangeRate,
        fiatAmount: cryptoPayment.fiatAmount,
        fiatCurrency: cryptoPayment.fiatCurrency,
        testMode: isTestMode(),
        testnet: isTestnetEnabled()
      });
    }

    // Otherwise, get the most recent pending crypto payment for this invoice
    const cryptoPayment = await prisma.cryptoPayment.findFirst({
      where: {
        payment: {
          invoiceId: invoiceId
        },
        status: 'pending',
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        payment: {
          include: {
            invoice: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (!cryptoPayment) {
      return NextResponse.json(
        { error: 'No pending crypto payment found' },
        { status: 404 }
      );
    }

    // Generate QR code data
    // For XRP, include destination tag in QR code
    const isXRP = cryptoPayment.cryptocurrencyCode.toLowerCase() === 'xrp';
    let qrCodeData = `${cryptoPayment.cryptocurrencyCode}:${cryptoPayment.address}`;
    if (isXRP && cryptoPayment.destinationTag !== null) {
      qrCodeData += `?dt=${cryptoPayment.destinationTag}&amount=${cryptoPayment.amount}`;
    } else {
      qrCodeData += `?amount=${cryptoPayment.amount}`;
    }

    return NextResponse.json({
      paymentId: cryptoPayment.paymentId,
      cryptoPaymentId: cryptoPayment.id,
      cryptocurrency: cryptoPayment.cryptocurrencyCode.toUpperCase(),
      cryptoAmount: cryptoPayment.amount.toString(),
      address: cryptoPayment.address,
      destinationTag: cryptoPayment.destinationTag, // Include destination tag
      qrCode: qrCodeData,
      expiresAt: cryptoPayment.expiresAt.toISOString(),
      minConfirmations: cryptoPayment.minConfirmations,
      exchangeRate: cryptoPayment.exchangeRate,
      fiatAmount: cryptoPayment.fiatAmount,
      fiatCurrency: cryptoPayment.fiatCurrency,
      testMode: isTestMode(),
      testnet: isTestnetEnabled()
    });
  } catch (error: any) {
    console.error('Error fetching crypto payment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch crypto payment' },
      { status: 500 }
    );
  }
}
