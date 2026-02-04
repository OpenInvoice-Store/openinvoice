/**
 * Solana Account Generator using @solana/kit
 * Follows official Solana documentation patterns
 */

import {
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  generateKeyPairSigner,
  lamports,
  type Address,
  type Rpc,
  type GetBalanceApi,
  type RequestAirdropApi,
  type GetSignatureStatusesApi
} from '@solana/kit';
import { isTestnetEnabled } from './blockchain-monitor';

export interface SolanaAccount {
  address: string;
  privateKey: string; // Base58 encoded private key
  balance?: string; // Initial balance in SOL
}

const LAMPORTS_PER_SOL = BigInt(1_000_000_000);

/**
 * Get Solana RPC clients following official pattern
 */
function getSolanaRpcClients(isTestnet: boolean = false): {
  rpc: Rpc<GetBalanceApi & RequestAirdropApi & GetSignatureStatusesApi>;
  rpcSubscriptions: ReturnType<typeof createSolanaRpcSubscriptions>;
} {
  // Follow official endpoint patterns from Solana docs
  // Use devnet for testnet (devnet has higher faucet limits than testnet)
  const rpcUrl = isTestnet
    ? process.env.SOLANA_TESTNET_RPC_URL ||
      process.env.SOLANA_DEVNET_RPC_URL ||
      'https://api.devnet.solana.com' // Use devnet by default (higher limits)
    : process.env.SOLANA_MAINNET_RPC_URL ||
      'https://api.mainnet-beta.solana.com';

  const wsUrl = isTestnet
    ? process.env.SOLANA_TESTNET_WS_URL ||
      process.env.SOLANA_DEVNET_WS_URL ||
      'wss://api.devnet.solana.com'
    : process.env.SOLANA_MAINNET_WS_URL || 'wss://api.mainnet-beta.solana.com';

  return {
    rpc: createSolanaRpc(rpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(wsUrl)
  };
}

/**
 * Request airdrop with retry logic to handle rate limits
 */
async function requestAirdropWithRetry(
  rpc: Rpc<RequestAirdropApi & GetSignatureStatusesApi>,
  address: Address,
  amount: bigint,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Add delay before retry (exponential backoff)
      if (attempt > 0) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
        console.log(
          `[Solana] Retrying airdrop request (attempt ${attempt + 1}/${maxRetries}) after ${delayMs}ms delay...`
        );
        await new Promise((r) => setTimeout(r, delayMs));
      }

      // Request airdrop following official pattern
      const airdropSignature = await rpc
        .requestAirdrop(address, lamports(amount))
        .send();

      // Wait for confirmation following official pattern
      let retries = 0;
      const maxConfirmationRetries = 30; // 30 seconds max wait
      while (retries < maxConfirmationRetries) {
        const status = await rpc
          .getSignatureStatuses([airdropSignature])
          .send();
        if (status.value?.[0]?.confirmationStatus === 'confirmed') {
          return airdropSignature;
        }
        await new Promise((r) => setTimeout(r, 1000));
        retries++;
      }

      throw new Error('Airdrop confirmation timeout');
    } catch (error: any) {
      lastError = error;
      const isRateLimit =
        error?.message?.includes('429') ||
        error?.message?.includes('Too Many Requests') ||
        error?.code === 429;

      if (isRateLimit && attempt < maxRetries - 1) {
        console.warn(
          `[Solana] Rate limit hit (attempt ${attempt + 1}/${maxRetries}), will retry...`
        );
        continue;
      }

      // If not rate limit or last attempt, throw immediately
      if (!isRateLimit || attempt === maxRetries - 1) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Failed to request airdrop after retries');
}

/**
 * Create a new Solana account using the faucet (testnet/devnet only)
 * Follows official pattern: rpc.requestAirdrop() + getSignatureStatuses()
 * Includes retry logic for rate limit handling
 */
export async function createSolanaAccount(
  isTestnet?: boolean,
  airdropAmount: number = 1
): Promise<SolanaAccount> {
  const useTestnet = isTestnet ?? isTestnetEnabled();

  if (!useTestnet) {
    throw new Error(
      'Account creation via faucet is only available on testnet/devnet. ' +
        'For mainnet, you must generate accounts manually using a secure wallet.'
    );
  }

  try {
    // Generate wallet using official pattern
    const wallet = await generateKeyPairSigner();
    const address = wallet.address;

    // Get RPC clients
    const { rpc } = getSolanaRpcClients(useTestnet);

    // Request airdrop with retry logic
    await requestAirdropWithRetry(
      rpc,
      wallet.address,
      BigInt(airdropAmount) * LAMPORTS_PER_SOL
    );

    // Get balance after airdrop
    const { value } = await rpc.getBalance(wallet.address).send();
    const balanceSOL = Number(value) / Number(LAMPORTS_PER_SOL);

    return {
      address,
      privateKey:
        typeof (wallet as any).export === 'function'
          ? (wallet as any).export().privateKey
          : undefined,
      balance: balanceSOL.toString()
    };
  } catch (error: any) {
    console.error('[Solana] Error creating account:', error);

    // Provide helpful error message for rate limits
    const isRateLimit =
      error?.message?.includes('429') ||
      error?.message?.includes('Too Many Requests') ||
      error?.code === 429;

    if (isRateLimit) {
      throw new Error(
        'Solana testnet faucet rate limit exceeded. Please wait a few minutes and try again, or use devnet which has higher limits. ' +
          'You can also generate an unfunded account and fund it manually.'
      );
    }

    throw new Error(`Failed to create Solana account: ${error.message}`);
  }
}

/**
 * Generate a new Solana wallet without funding
 */
export async function generateSolanaWallet(): Promise<SolanaAccount> {
  const wallet = await generateKeyPairSigner();
  return {
    address: wallet.address,
    privateKey:
      typeof (wallet as any).export === 'function'
        ? (wallet as any).export().privateKey
        : undefined,
    balance: '0'
  };
}

/**
 * Get SOL balance following official pattern
 */
export async function getSolanaBalance(
  address: string,
  isTestnet?: boolean
): Promise<string> {
  const useTestnet = isTestnet ?? isTestnetEnabled();

  try {
    const { rpc } = getSolanaRpcClients(useTestnet);
    const { value } = await rpc.getBalance(address as Address).send();
    const balanceSOL = Number(value) / Number(LAMPORTS_PER_SOL);
    return balanceSOL.toString();
  } catch (error: any) {
    console.error('[Solana] Error getting balance:', error);
    throw new Error(`Failed to get Solana balance: ${error.message}`);
  }
}
