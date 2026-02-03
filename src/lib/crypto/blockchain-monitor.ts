/**
 * Blockchain Monitoring Service
 * Checks for incoming cryptocurrency transactions on the blockchain
 * Similar to Boxcoin's bxc_blockchain function
 *
 * Supports:
 * - Mainnet (production)
 * - Testnet (development)
 * - Test Mode (simulated transactions)
 */

import { Client } from 'xrpl';

// Configuration
const CRYPTO_TEST_MODE = process.env.CRYPTO_TEST_MODE === 'true';
const USE_TESTNET =
  process.env.CRYPTO_USE_TESTNET === 'true' ||
  process.env.NODE_ENV === 'development';

interface BlockchainTransaction {
  hash: string;
  amount: string; // Amount as string to preserve precision
  confirmations: number;
  blockHeight?: number;
  timestamp?: number;
  from?: string;
}

interface BlockchainExplorerResponse {
  transactions?: Array<{
    hash: string;
    value: number | string;
    confirmations?: number;
    block_height?: number;
    time?: number;
    from?: string;
  }>;
  transaction?: {
    hash: string;
    value: number | string;
    confirmations?: number;
    block_height?: number;
    time?: number;
    from?: string;
  };
}

/**
 * Check if address is testnet
 */
function isTestnetAddress(address: string, crypto: string): boolean {
  // If testnet is explicitly enabled via env var, use testnet
  if (USE_TESTNET) return true;

  const cryptoLower = crypto.toLowerCase();
  if (cryptoLower === 'xrp') {
    // XRP addresses look the same for mainnet/testnet
    // In development mode, default to testnet
    return process.env.NODE_ENV === 'development';
  }
  return false;
}

/**
 * Get Bitcoin transactions for an address
 */
async function getBitcoinTransactions(
  address: string,
  sinceTimestamp?: Date,
  isTestnet: boolean = false
): Promise<BlockchainTransaction[]> {
  const since = sinceTimestamp
    ? Math.floor(sinceTimestamp.getTime() / 1000)
    : undefined;

  const baseUrl = isTestnet
    ? 'https://mempool.space/testnet/api'
    : 'https://mempool.space/api';

  // Try mempool.space first (free, no API key needed)
  try {
    const url = `${baseUrl}/address/${address}/txs`;
    const response = await fetch(url, {
      next: { revalidate: 30 } // Cache for 30 seconds
    });

    if (response.ok) {
      const data = await response.json();
      const transactions: BlockchainTransaction[] = [];

      for (const tx of data) {
        // Find outputs to our address
        for (const vout of tx.vout || []) {
          if (
            vout.scriptpubkey_address === address ||
            vout.scriptpubkey_addresses?.includes(address)
          ) {
            const value = vout.value / 100000000; // Convert satoshis to BTC
            const txTime = tx.status?.block_time || tx.status?.block_height;

            if (!since || (txTime && txTime >= since)) {
              transactions.push({
                hash: tx.txid,
                amount: value.toString(),
                confirmations: tx.status?.block_height
                  ? await getBitcoinBlockHeight().then(
                      (currentHeight) =>
                        currentHeight - tx.status.block_height + 1
                    )
                  : 0,
                blockHeight: tx.status?.block_height,
                timestamp: txTime
              });
            }
          }
        }
      }

      return transactions;
    }
  } catch (error) {
    console.error('Error fetching from mempool.space:', error);
  }

  // Fallback to blockstream.info
  try {
    const blockstreamUrl = isTestnet
      ? `https://blockstream.info/testnet/api/address/${address}/txs`
      : `https://blockstream.info/api/address/${address}/txs`;
    const url = blockstreamUrl;
    const response = await fetch(url, {
      next: { revalidate: 30 }
    });

    if (response.ok) {
      const data = await response.json();
      const transactions: BlockchainTransaction[] = [];

      for (const tx of data) {
        for (const vout of tx.vout || []) {
          if (
            vout.scriptpubkey_address === address ||
            vout.scriptpubkey_addresses?.includes(address)
          ) {
            const value = vout.value / 100000000;
            const txTime = tx.status?.block_time;

            if (!since || (txTime && txTime >= since)) {
              transactions.push({
                hash: tx.txid,
                amount: value.toString(),
                confirmations: tx.status?.block_height
                  ? await getBitcoinBlockHeight().then(
                      (currentHeight) =>
                        currentHeight - tx.status.block_height + 1
                    )
                  : 0,
                blockHeight: tx.status?.block_height,
                timestamp: txTime
              });
            }
          }
        }
      }

      return transactions;
    }
  } catch (error) {
    console.error('Error fetching from blockstream.info:', error);
  }

  return [];
}

/**
 * Get Ethereum transactions for an address
 */
async function getEthereumTransactions(
  address: string,
  sinceTimestamp?: Date,
  isTestnet: boolean = false
): Promise<BlockchainTransaction[]> {
  const since = sinceTimestamp
    ? Math.floor(sinceTimestamp.getTime() / 1000)
    : undefined;

  // Use Etherscan API (free tier: 5 calls/sec)
  const etherscanApiKey = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken';
  const baseUrl = isTestnet
    ? 'https://api-sepolia.etherscan.io/api'
    : 'https://api.etherscan.io/api';

  try {
    // Get normal transactions
    const url = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=asc&apikey=${etherscanApiKey}`;
    const response = await fetch(url, {
      next: { revalidate: 30 }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === '1' && data.result) {
        const transactions: BlockchainTransaction[] = [];

        for (const tx of data.result) {
          const txTime = parseInt(tx.timeStamp);
          if (!since || txTime >= since) {
            // Convert from Wei to ETH
            const value = parseFloat(tx.value) / 1e18;

            transactions.push({
              hash: tx.hash,
              amount: value.toString(),
              confirmations: tx.confirmations ? parseInt(tx.confirmations) : 0,
              blockHeight: tx.blockNumber
                ? parseInt(tx.blockNumber)
                : undefined,
              timestamp: txTime,
              from: tx.from
            });
          }
        }

        return transactions;
      }
    }
  } catch (error) {
    console.error('Error fetching from Etherscan:', error);
  }

  return [];
}

/**
 * Get Bitcoin current block height
 */
async function getBitcoinBlockHeight(
  isTestnet: boolean = false
): Promise<number> {
  try {
    const url = isTestnet
      ? 'https://mempool.space/testnet/api/blocks/tip/height'
      : 'https://mempool.space/api/blocks/tip/height';
    const response = await fetch(url, {
      next: { revalidate: 60 }
    });
    if (response.ok) {
      return parseInt(await response.text());
    }
  } catch (error) {
    console.error('Error fetching Bitcoin block height:', error);
  }
  return 0;
}

/**
 * Get Ethereum current block number
 */
async function getEthereumBlockNumber(
  isTestnet: boolean = false
): Promise<number> {
  try {
    const etherscanApiKey = process.env.ETHERSCAN_API_KEY || 'YourApiKeyToken';
    const baseUrl = isTestnet
      ? 'https://api-sepolia.etherscan.io/api'
      : 'https://api.etherscan.io/api';
    const url = `${baseUrl}?module=proxy&action=eth_blockNumber&apikey=${etherscanApiKey}`;
    const response = await fetch(url, {
      next: { revalidate: 60 }
    });
    if (response.ok) {
      const data = await response.json();
      return parseInt(data.result, 16);
    }
  } catch (error) {
    console.error('Error fetching Ethereum block number:', error);
  }
  return 0;
}

/**
 * Get XRP transactions for an address
 * Uses xrpl Client library directly (following XRPL tutorial best practices)
 * XRP transactions confirm in 3-5 seconds (very fast!)
 */
async function getXRPTransactions(
  address: string,
  sinceTimestamp?: Date,
  isTestnet: boolean = false
): Promise<BlockchainTransaction[]> {
  const since = sinceTimestamp
    ? Math.floor(sinceTimestamp.getTime() / 1000)
    : undefined;

  let client: Client | null = null;

  try {
    let transactions: BlockchainTransaction[] = [];

    // Use xrpl Client library (following tutorial approach)
    const serverUrl = isTestnet
      ? 'wss://s.altnet.rippletest.net:51233' // Testnet WebSocket
      : 'wss://xrplcluster.com'; // Mainnet cluster

    client = new Client(serverUrl);
    await client.connect();

    // Use account_tx method (as shown in tutorial)
    const response = await client.request({
      command: 'account_tx',
      account: address,
      ledger_index_min: -1,
      ledger_index_max: -1,
      limit: 100,
      binary: false,
      forward: false
    });

    if (response.status === 'success' && response.result.transactions) {
      for (const txWrapper of response.result.transactions) {
        const tx = txWrapper.tx as any;
        const meta = txWrapper.meta as any;

        if (
          tx &&
          tx.TransactionType === 'Payment' &&
          tx.Destination === address
        ) {
          // Check if transaction succeeded
          if (
            meta &&
            typeof meta === 'object' &&
            meta.TransactionResult === 'tesSUCCESS'
          ) {
            // Get delivered amount from metadata (handles partial payments)
            let amountDrops = 0;
            if (meta.delivered_amount) {
              amountDrops =
                typeof meta.delivered_amount === 'string'
                  ? parseFloat(meta.delivered_amount)
                  : meta.delivered_amount;
            } else if (tx.Amount) {
              amountDrops =
                typeof tx.Amount === 'string'
                  ? parseFloat(tx.Amount)
                  : tx.Amount;
            }

            // Convert drops to XRP (1 XRP = 1,000,000 drops)
            const amount = amountDrops / 1000000;

            // Get transaction timestamp
            // Try to get ledger close time for accurate timestamp
            let txTime: number | undefined = undefined;
            const ledgerIndex = txWrapper.ledger_index || tx.ledger_index;

            if (ledgerIndex) {
              try {
                // Get ledger close time for accurate timestamp
                const ledgerResponse = await client!.request({
                  command: 'ledger',
                  ledger_index: ledgerIndex
                });
                if (
                  ledgerResponse.result &&
                  typeof ledgerResponse.result === 'object' &&
                  'ledger' in ledgerResponse.result
                ) {
                  const ledger = (ledgerResponse.result as any).ledger;
                  if (ledger && ledger.close_time) {
                    txTime = ledger.close_time;
                  }
                }
              } catch (error) {
                // Fallback to current time if ledger lookup fails
                txTime = Math.floor(Date.now() / 1000);
              }
            }

            if (!since || !txTime || txTime >= since) {
              transactions.push({
                hash: tx.hash,
                amount: amount.toString(),
                confirmations: ledgerIndex ? 1 : 0, // XRP confirms in 3-5 seconds
                blockHeight: ledgerIndex,
                timestamp: txTime,
                from: tx.Account
              });
            }
          }
        }
      }
    }

    return transactions;
  } catch (error: any) {
    console.error('[XRP] Error fetching transactions:', error);
    throw new Error(`Failed to fetch XRP transactions: ${error.message}`);
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
 * Get XRP Ledger current ledger index (equivalent to block height)
 * Uses xrpl Client library directly (following XRPL tutorial best practices)
 */
export async function getXRPBlockHeight(
  isTestnet: boolean = false
): Promise<number> {
  let client: Client | null = null;

  try {
    // Use xrpl Client library (following tutorial approach)
    const serverUrl = isTestnet
      ? 'wss://s.altnet.rippletest.net:51233' // Testnet WebSocket
      : 'wss://xrplcluster.com'; // Mainnet cluster

    client = new Client(serverUrl);
    await client.connect();

    // Use ledger command (as shown in tutorial)
    const response = await client.request({
      command: 'ledger',
      ledger_index: 'validated'
    });

    if (response.status === 'success' && response.result.ledger) {
      return response.result.ledger.ledger_index || 0;
    }

    return 0;
  } catch (error) {
    console.error('[XRP] Error fetching block height:', error);
    return 0;
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
 * Simulate transaction for test mode
 */
function simulateTestTransaction(
  address: string,
  minAmount: string,
  sinceTimestamp: Date
): BlockchainTransaction | null {
  if (!CRYPTO_TEST_MODE) return null;

  // Simulate transaction appearing after 5 seconds
  const timeSinceCreation = Date.now() - sinceTimestamp.getTime();
  const secondsSinceCreation = Math.floor(timeSinceCreation / 1000);

  // Transaction appears after 5 seconds
  if (secondsSinceCreation < 5) {
    return null;
  }

  // Simulate confirmations increasing over time (1 per 10 seconds)
  const simulatedConfirmations = Math.floor((secondsSinceCreation - 5) / 10);

  if (simulatedConfirmations >= 0) {
    return {
      hash: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      amount: minAmount,
      confirmations: Math.min(simulatedConfirmations, 6), // Max 6 confirmations
      timestamp: Math.floor(Date.now() / 1000),
      blockHeight: 1000000 + simulatedConfirmations
    };
  }

  return null;
}

/**
 * Check for transactions matching a payment
 */
export async function checkBlockchainTransactions(
  cryptocurrency: string,
  address: string,
  minAmount: string,
  sinceTimestamp: Date
): Promise<BlockchainTransaction | null> {
  // Test mode: simulate transactions
  if (CRYPTO_TEST_MODE) {
    const simulated = simulateTestTransaction(
      address,
      minAmount,
      sinceTimestamp
    );
    if (simulated) {
      console.log('[CRYPTO TEST MODE] Simulated transaction:', {
        hash: simulated.hash,
        amount: simulated.amount,
        confirmations: simulated.confirmations
      });
      return simulated;
    }
    return null;
  }

  const crypto = cryptocurrency.toLowerCase();
  const isTestnet = USE_TESTNET || isTestnetAddress(address, crypto);

  try {
    let transactions: BlockchainTransaction[] = [];

    if (crypto === 'xrp') {
      transactions = await getXRPTransactions(
        address,
        sinceTimestamp,
        isTestnet
      );
    } else {
      throw new Error(`Unsupported cryptocurrency: ${cryptocurrency}`);
    }

    // Find matching transaction
    const minAmountNum = parseFloat(minAmount);
    for (const tx of transactions) {
      const txAmount = parseFloat(tx.amount);

      // Check if amount matches (with small tolerance for rounding)
      if (
        txAmount >= minAmountNum * 0.99 && // Allow 1% tolerance
        txAmount <= minAmountNum * 1.01
      ) {
        console.log(`[CRYPTO] Found matching transaction:`, {
          hash: tx.hash,
          amount: tx.amount,
          expected: minAmount,
          confirmations: tx.confirmations,
          testnet: isTestnet
        });
        return tx;
      }
    }

    return null;
  } catch (error: any) {
    console.error(`[CRYPTO] Error checking blockchain transactions:`, {
      cryptocurrency,
      address,
      error: error.message,
      testnet: isTestnet
    });
    throw error;
  }
}

/**
 * Get transaction details by hash
 */
export async function getTransactionDetails(
  cryptocurrency: string,
  transactionHash: string,
  isTestnet: boolean = false
): Promise<BlockchainTransaction | null> {
  // Test mode: return simulated transaction
  if (CRYPTO_TEST_MODE && transactionHash.startsWith('test_')) {
    // Extract confirmations from hash or simulate
    const simulatedConfirmations = Math.floor(Math.random() * 6) + 1;
    return {
      hash: transactionHash,
      amount: '0.001', // Placeholder
      confirmations: simulatedConfirmations,
      timestamp: Math.floor(Date.now() / 1000),
      blockHeight: 1000000 + simulatedConfirmations
    };
  }

  const crypto = cryptocurrency.toLowerCase();

  if (crypto === 'xrp') {
    let client: Client | null = null;

    try {
      // Use xrpl Client library (following tutorial approach)
      const serverUrl = isTestnet
        ? 'wss://s.altnet.rippletest.net:51233' // Testnet WebSocket
        : 'wss://xrplcluster.com'; // Mainnet cluster

      client = new Client(serverUrl);
      await client.connect();

      // Use tx command (as shown in tutorial)
      const response = await client.request({
        command: 'tx',
        transaction: transactionHash,
        binary: false
      });

      if (response.status === 'success' && response.result) {
        const tx = response.result as any;
        const meta = tx.meta as any;

        if (
          meta &&
          typeof meta === 'object' &&
          meta.TransactionResult === 'tesSUCCESS'
        ) {
          // Get delivered amount from metadata (handles partial payments)
          let amountDrops = 0;
          if (meta.delivered_amount) {
            amountDrops =
              typeof meta.delivered_amount === 'string'
                ? parseFloat(meta.delivered_amount)
                : meta.delivered_amount;
          } else if (tx.tx_json && tx.tx_json.Amount) {
            amountDrops =
              typeof tx.tx_json.Amount === 'string'
                ? parseFloat(tx.tx_json.Amount)
                : tx.tx_json.Amount;
          }

          const amount = amountDrops / 1000000; // Convert drops to XRP

          // Get ledger close time for accurate timestamp
          let timestamp: number | undefined = undefined;
          if (tx.ledger_index) {
            try {
              const ledgerResponse = await client.request({
                command: 'ledger',
                ledger_index: tx.ledger_index
              });
              if (
                ledgerResponse.result &&
                typeof ledgerResponse.result === 'object' &&
                'ledger' in ledgerResponse.result
              ) {
                const ledger = (ledgerResponse.result as any).ledger;
                if (ledger && ledger.close_time) {
                  timestamp = ledger.close_time;
                }
              }
            } catch (error) {
              // Fallback to date if available
              if (tx.date) {
                timestamp = Math.floor(new Date(tx.date).getTime() / 1000);
              }
            }
          }

          return {
            hash: transactionHash,
            amount: amount.toString(),
            confirmations: tx.ledger_index ? 1 : 0,
            blockHeight: tx.ledger_index,
            timestamp: timestamp,
            from: tx.tx_json?.Account
          };
        }
      }
    } catch (error) {
      console.error('Error fetching XRP transaction:', error);
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

  return null;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerUrl(
  cryptocurrency: string,
  transactionHash: string,
  isTestnet: boolean = false
): string {
  const crypto = cryptocurrency.toLowerCase();

  // Test mode: return placeholder
  if (CRYPTO_TEST_MODE && transactionHash.startsWith('test_')) {
    return `#test-transaction-${transactionHash}`;
  }

  switch (crypto) {
    case 'xrp':
      return isTestnet
        ? `https://testnet.xrpl.org/transactions/${transactionHash}`
        : `https://xrpscan.com/tx/${transactionHash}`;
    default:
      return `https://blockchair.com/${crypto}/transaction/${transactionHash}`;
  }
}

/**
 * Check if test mode is enabled
 */
export function isTestMode(): boolean {
  return CRYPTO_TEST_MODE;
}

/**
 * Check if testnet is enabled
 */
export function isTestnetEnabled(): boolean {
  return USE_TESTNET;
}
