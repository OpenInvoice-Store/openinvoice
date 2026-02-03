import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import {
  createXRPAccount,
  generateXRPWallet
} from '@/lib/crypto/xrp-account-generator';
import { addCryptoAddress } from '@/lib/crypto/address-management';
import { isTestnetEnabled } from '@/lib/crypto/blockchain-monitor';

export async function GET(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        cryptoPaymentsEnabled: true,
        cryptoWallets: true,
        cryptoMinConfirmations: true,
        stopReusingAddresses: true,
        addressReuseCooldownHours: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(organization);
  } catch (error: any) {
    console.error('Error fetching crypto settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch crypto settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      cryptoPaymentsEnabled,
      cryptoMinConfirmations,
      stopReusingAddresses,
      addressReuseCooldownHours,
      xrpAddresses
    } = body;

    // Build crypto wallets JSON
    const cryptoWallets: Record<string, string[]> = {};
    if (xrpAddresses && Array.isArray(xrpAddresses)) {
      cryptoWallets.xrp = xrpAddresses.filter((addr: string) => addr.trim());
    }

    // Update organization
    const organization = await prisma.organization.update({
      where: { id: orgId },
      data: {
        cryptoPaymentsEnabled: cryptoPaymentsEnabled ?? false,
        cryptoMinConfirmations: cryptoMinConfirmations ?? 3,
        stopReusingAddresses: stopReusingAddresses ?? false,
        addressReuseCooldownHours: addressReuseCooldownHours ?? 24,
        cryptoWallets:
          Object.keys(cryptoWallets).length > 0
            ? JSON.stringify(cryptoWallets)
            : null
      }
    });

    return NextResponse.json({
      success: true,
      organization: {
        cryptoPaymentsEnabled: organization.cryptoPaymentsEnabled,
        cryptoWallets: organization.cryptoWallets,
        cryptoMinConfirmations: organization.cryptoMinConfirmations,
        stopReusingAddresses: organization.stopReusingAddresses,
        addressReuseCooldownHours: organization.addressReuseCooldownHours
      }
    });
  } catch (error: any) {
    console.error('Error updating crypto settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update crypto settings' },
      { status: 500 }
    );
  }
}

/**
 * Generate a new XRP account and add it to the organization
 * POST /api/organizations/crypto
 *
 * Generates a regular XRP receiving address for invoice payments.
 * These are receiving addresses (not operational/standby wallets).
 * Customers will send XRP to these addresses to pay invoices.
 */
export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { useFaucet } = body; // Whether to use faucet (testnet only)

    const isTestnet = isTestnetEnabled();

    let account;
    if (useFaucet && isTestnet) {
      // Create account using faucet (testnet only, as shown in tutorial)
      account = await createXRPAccount(true);
    } else {
      // Generate wallet without funding (for mainnet or manual funding)
      account = generateXRPWallet();
    }

    // Add the address to the organization
    await addCryptoAddress(orgId, 'xrp', account.address);

    return NextResponse.json({
      success: true,
      account: {
        address: account.address,
        seed: account.seed, // Return seed so user can save it
        balance: account.balance || '0',
        funded: !!account.balance && account.balance !== '0'
      },
      warning: isTestnet
        ? 'This is a testnet account. Save the seed securely if you want to reuse this account.'
        : 'This account is not funded. You must fund it manually before using it for payments.'
    });
  } catch (error: any) {
    console.error('Error generating XRP account:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate XRP account' },
      { status: 500 }
    );
  }
}
