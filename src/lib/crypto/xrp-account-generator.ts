/**
 * XRP Account Generator
 * Creates XRP accounts using xrpl Client library (following XRPL tutorial)
 * Returns address and seed (secret) for the generated account
 *
 * Note: These are regular XRP receiving addresses for invoice payments.
 * The "operational" and "standby" labels in XRPL tutorials refer to accounts
 * used for sending transactions (hot/cold wallets). For receiving payments,
 * we just need regular addresses that can receive XRP.
 */

import { Client, Wallet } from 'xrpl';
import { isTestnetEnabled } from './blockchain-monitor';

export interface XRPAccount {
  address: string;
  seed: string; // Secret/seed phrase
  balance?: string; // Initial balance in XRP
}

/**
 * Create a new XRP account using the faucet (testnet/devnet only)
 * Following the tutorial pattern: client.fundWallet()
 *
 * @param isTestnet - Whether to use testnet (default: from env/config)
 * @returns Promise<XRPAccount> - Account with address and seed
 */
export async function createXRPAccount(
  isTestnet?: boolean
): Promise<XRPAccount> {
  const useTestnet = isTestnet ?? isTestnetEnabled();

  if (!useTestnet) {
    throw new Error(
      'Account creation via faucet is only available on testnet/devnet. ' +
        'For mainnet, you must generate accounts manually using a secure wallet.'
    );
  }

  let client: Client | null = null;

  try {
    // Use xrpl Client library (following tutorial approach)
    const serverUrl = 'wss://s.altnet.rippletest.net:51233'; // Testnet WebSocket

    client = new Client(serverUrl);
    await client.connect();

    // Create and fund a test account wallet (as shown in tutorial)
    // fundWallet() creates a new wallet and funds it from the testnet faucet
    const faucetHost = undefined; // Use default faucet
    const fundResult = await client.fundWallet(null, { faucetHost });
    const wallet = fundResult.wallet;

    // Get the current balance
    const balance = await client.getXrpBalance(wallet.address);

    return {
      address: wallet.address,
      seed: wallet.seed || '', // Secret seed phrase
      balance: balance.toString()
    };
  } catch (error: any) {
    console.error('[XRP] Error creating account:', error);
    throw new Error(`Failed to create XRP account: ${error.message}`);
  } finally {
    // Always disconnect client
    if (client && client.isConnected()) {
      try {
        await client.disconnect();
      } catch (disconnectError) {
        console.error('[XRP] Error disconnecting client:', disconnectError);
      }
    }
  }
}

/**
 * Generate a new XRP wallet without funding (for mainnet or manual funding)
 * This creates a wallet but doesn't fund it from a faucet
 *
 * @returns XRPAccount - Account with address and seed (not funded)
 */
export function generateXRPWallet(): XRPAccount {
  // Generate a new random wallet
  const wallet = Wallet.generate();

  return {
    address: wallet.address,
    seed: wallet.seed || '',
    balance: '0' // Not funded
  };
}

/**
 * Get account from seed (recover existing wallet)
 * Following tutorial pattern: Wallet.fromSeed()
 *
 * @param seed - The seed/secret phrase
 * @returns XRPAccount - Account recovered from seed
 */
export function getAccountFromSeed(seed: string): XRPAccount {
  try {
    const wallet = Wallet.fromSeed(seed);

    return {
      address: wallet.address,
      seed: wallet.seed || seed,
      balance: undefined // Balance needs to be fetched separately
    };
  } catch (error: any) {
    throw new Error(`Invalid seed: ${error.message}`);
  }
}

/**
 * Get XRP balance for an address
 * Following tutorial pattern: client.getXrpBalance()
 *
 * @param address - XRP address
 * @param isTestnet - Whether to use testnet
 * @returns Promise<string> - Balance in XRP
 */
export async function getXRPBalance(
  address: string,
  isTestnet?: boolean
): Promise<string> {
  const useTestnet = isTestnet ?? isTestnetEnabled();
  let client: Client | null = null;

  try {
    const serverUrl = useTestnet
      ? 'wss://s.altnet.rippletest.net:51233'
      : 'wss://xrplcluster.com';

    client = new Client(serverUrl);
    await client.connect();

    // Get balance (as shown in tutorial)
    const balance = await client.getXrpBalance(address);
    return balance.toString();
  } catch (error: any) {
    console.error('[XRP] Error getting balance:', error);
    throw new Error(`Failed to get XRP balance: ${error.message}`);
  } finally {
    if (client && client.isConnected()) {
      try {
        await client.disconnect();
      } catch (disconnectError) {
        console.error('[XRP] Error disconnecting client:', disconnectError);
      }
    }
  }
}
