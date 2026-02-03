/**
 * XRP WebSocket Monitor
 * Real-time transaction monitoring using XRPL official Client library
 * More efficient than polling - receives instant notifications
 */

import { Client } from 'xrpl';

interface XRPWebSocketConfig {
  address: string;
  onTransaction: (tx: XRPTransaction) => void;
  onError?: (error: Error) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  isTestnet?: boolean;
}

interface XRPTransaction {
  hash: string;
  amount: string; // XRP amount
  from: string;
  to: string;
  destinationTag?: number; // XRP destination tag for payment identification
  ledgerIndex?: number;
  timestamp?: number;
  validated: boolean;
}

class XRPWebSocketMonitor {
  private client: Client | null = null;
  private config: XRPWebSocketConfig;
  private isIntentionallyClosed = false;
  private connectionFailed = false;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private isConnecting = false; // Prevent multiple simultaneous connection attempts

  constructor(config: XRPWebSocketConfig) {
    this.config = config;
  }

  /**
   * Connect to XRP Ledger using official xrpl Client library
   */
  async connect(): Promise<void> {
    if (this.client && this.client.isConnected()) {
      console.log('[XRP WebSocket] Already connected');
      return;
    }

    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      console.log('[XRP WebSocket] Connection already in progress');
      return;
    }

    // If already failed, don't retry
    if (this.connectionFailed) {
      return;
    }

    this.isIntentionallyClosed = false;
    this.isConnecting = true;

    // Use official XRP Ledger endpoints
    const serverUrl = this.config.isTestnet
      ? 'wss://s.altnet.rippletest.net:51233' // Official testnet WebSocket
      : 'wss://xrplcluster.com'; // Mainnet cluster

    console.log(`[XRP WebSocket] Connecting to ${serverUrl}...`);

    try {
      // Create new client instance with increased timeout
      // Browser environments may need more time due to security checks
      this.client = new Client(serverUrl, {
        connectionTimeout: 10000 // 10 seconds instead of default 5 seconds
      });

      // Set up transaction event listener BEFORE connecting
      // According to XRPL docs: https://xrpl.org/monitor-incoming-payments-with-websocket.html
      // Transaction events have structure: { transaction, meta, validated, ledger_index }
      // xrpl.js Client emits 'transaction' events when subscribed to accounts
      this.client.on('transaction', (tx: any) => {
        console.log('[XRP WebSocket] Raw transaction event received:', {
          type: typeof tx,
          keys: tx ? Object.keys(tx) : [],
          validated: tx?.validated,
          hasTransaction: !!tx?.transaction,
          hasTxJson: !!tx?.tx_json,
          transactionType:
            tx?.transaction?.TransactionType || tx?.tx_json?.TransactionType,
          destination: tx?.transaction?.Destination || tx?.tx_json?.Destination,
          hash: tx?.transaction?.hash || tx?.hash || tx?.tx_json?.hash,
          meta: tx?.meta ? Object.keys(tx.meta) : [],
          fullTx: JSON.stringify(tx, null, 2).substring(0, 500) // First 500 chars for debugging
        });
        this.handleTransaction(tx);
      });

      // Also listen for ledger events to see all activity
      this.client.on('ledgerClosed', (ledger: any) => {
        console.log('[XRP WebSocket] Ledger closed:', {
          ledger_index: ledger.ledger_index,
          txn_count: ledger.txn_count
        });
      });

      // Set up event handlers
      this.client.on('connected', () => {
        console.log('[XRP WebSocket] Connected to XRP Ledger');
        this.connectionFailed = false;
        this.isConnecting = false;
        this.subscribe();
        this.config.onConnect?.();
      });

      this.client.on('disconnected', (code: number) => {
        console.log('[XRP WebSocket] Disconnected', { code });
        this.isConnecting = false;
        this.config.onDisconnect?.();

        // Don't auto-reconnect if intentionally closed, already failed, or currently connecting
        if (
          this.isIntentionallyClosed ||
          this.connectionFailed ||
          this.isConnecting
        ) {
          return;
        }

        // Only reconnect once - if it fails, fall back to polling
        console.log('[XRP WebSocket] Attempting to reconnect...');
        this.reconnectTimeout = setTimeout(() => {
          this.connect().catch((error) => {
            console.log('[XRP WebSocket] Reconnection failed:', error);
            this.connectionFailed = true;
            this.config.onError?.(
              new Error(
                'WebSocket reconnection failed - falling back to polling'
              )
            );
          });
        }, 3000);
      });

      this.client.on('error', (error: Error) => {
        console.log('[XRP WebSocket] Client error:', error);
        this.connectionFailed = true;
        this.config.onError?.(error);
      });

      // Connect to the server
      await this.client.connect();
    } catch (error: any) {
      this.isConnecting = false;
      console.log('[XRP WebSocket] Failed to connect:', error);

      // Check if it's a timeout error (browser/network restriction)
      const isTimeoutError =
        error?.message?.includes('timed out') ||
        error?.message?.includes('timeout') ||
        error?.name === 'NotConnectedError';

      if (isTimeoutError) {
        // Timeout usually means browser/network restriction - fail fast and use polling
        console.warn(
          '[XRP WebSocket] Connection timeout - likely browser security restriction, will use polling'
        );
        this.connectionFailed = true;
        this.config.onError?.(
          new Error('WebSocket connection timeout - using polling instead')
        );
      } else {
        // Other errors - mark as failed but allow retry
        this.connectionFailed = true;
        this.config.onError?.(error as Error);
      }
      throw error;
    }
  }

  /**
   * Subscribe to account transactions using XRPL subscribe method
   */
  private async subscribe(): Promise<void> {
    if (!this.client || !this.client.isConnected()) {
      console.log('[XRP WebSocket] Cannot subscribe - not connected');
      return;
    }

    try {
      // First, verify the account exists (optional check)
      // This helps identify if the account needs funding
      try {
        const accountInfo = await this.client.request({
          command: 'account_info',
          account: this.config.address,
          ledger_index: 'validated'
        });

        // Account exists, proceed with subscription
        console.log(`[XRP WebSocket] Account verified: ${this.config.address}`);
      } catch (accountError: any) {
        // Account might not exist yet - that's okay, we can still subscribe
        // The subscription will work once the account receives its first payment
        const errorCode =
          (accountError as any)?.error_code || accountError?.error;
        if (errorCode === 'actNotFound' || errorCode === 'actNotFunded') {
          console.log(
            `[XRP WebSocket] Account ${this.config.address} not funded yet - subscription will activate when account receives first payment`
          );
        } else {
          console.warn(`[XRP WebSocket] Account check warning:`, accountError);
        }
      }

      // Subscribe to account transactions
      // Note: Subscription works even for unfunded accounts
      const response = await this.client.request({
        command: 'subscribe',
        accounts: [this.config.address]
      });

      // Check response - XRPL subscription responses vary
      // A successful subscription may return:
      // - { status: 'success' }
      // - { type: 'response', result: {} } (empty result is normal for subscriptions)
      // - { type: 'response' } without error
      const hasError =
        (response as any).error ||
        (response.result as any)?.error ||
        (response.result as any)?.error_message;

      const isSuccess =
        !hasError &&
        (response.status === 'success' ||
          response.type === 'response' ||
          (response.result && typeof response.result === 'object'));

      if (isSuccess) {
        console.log(
          `[XRP WebSocket] Successfully subscribed to account: ${this.config.address}`
        );
      } else {
        // Log detailed error information
        const errorMessage =
          (response as any).error ||
          (response as any).error_message ||
          (response.result as any)?.error ||
          (response.result as any)?.error_message ||
          'Unknown subscription error';

        console.warn('[XRP WebSocket] Subscription response:', {
          response,
          errorMessage,
          address: this.config.address,
          note: 'Subscription may still work - XRPL subscriptions can succeed even with empty results'
        });

        // For unfunded accounts or other recoverable errors, don't trigger onError
        // The subscription will work once the account receives funds
        // Only trigger onError for critical failures
        const errorCode =
          (response.result as any)?.error_code || (response as any).error_code;
        if (
          errorCode &&
          errorCode !== 'actNotFound' &&
          errorCode !== 'actNotFunded'
        ) {
          // Critical error - trigger callback
          this.config.onError?.(
            new Error(`Subscription failed: ${errorMessage}`)
          );
        } else {
          // Recoverable error - just log it
          console.log(
            '[XRP WebSocket] Subscription may work once account is funded - continuing'
          );
        }
      }
    } catch (error: any) {
      console.error('[XRP WebSocket] Error subscribing:', error);
      // Check if it's a known error that we can handle gracefully
      const errorCode = error?.error_code || error?.error;
      if (errorCode === 'actNotFound' || errorCode === 'actNotFunded') {
        console.log(
          `[XRP WebSocket] Account ${this.config.address} not funded - will monitor once funded`
        );
        // Don't call onError for unfunded accounts - they'll work once funded
        return;
      }
      this.config.onError?.(error as Error);
    }
  }

  /**
   * Handle incoming transaction events from XRPL Client
   * According to XRPL docs: https://xrpl.org/monitor-incoming-payments-with-websocket.html
   * xrpl.js Client emits transaction events where the transaction fields are at the top level:
   * { Account, Amount, Destination, hash, meta: {...}, validated, ledger_index }
   */
  private handleTransaction(tx: any): void {
    // xrpl.js Client emits transactions with fields at top level:
    // { Account, Amount, Destination, hash, meta: {...}, validated, ledger_index }
    // OR wrapped format: { transaction: {...}, meta: {...}, validated, ledger_index }

    // Check if it's the direct format (fields at top level) or wrapped format
    const isDirectFormat =
      tx.TransactionType !== undefined || tx.Account !== undefined;
    const transaction = isDirectFormat ? tx : tx.transaction || tx.tx_json;
    const meta = tx.meta;
    const validated =
      tx.validated !== undefined
        ? tx.validated
        : meta?.TransactionResult === 'tesSUCCESS';
    const ledgerIndex = tx.ledger_index || transaction?.ledger_index;

    console.log('[XRP WebSocket] Processing transaction event:', {
      validated,
      hasTransaction: !!transaction,
      hasMeta: !!meta,
      transactionType: transaction?.TransactionType || tx.TransactionType,
      destination: transaction?.Destination || tx.Destination,
      ourAddress: this.config.address,
      addressesMatch:
        (transaction?.Destination || tx.Destination) === this.config.address,
      ledgerIndex,
      metaResult: meta?.TransactionResult
    });

    // Only process validated transactions
    if (!validated) {
      console.log('[XRP WebSocket] Transaction not validated, skipping');
      return;
    }

    // Only process Payment transactions to our address
    // Handle both formats: direct (tx.TransactionType) and wrapped (transaction.TransactionType)
    const txType = transaction?.TransactionType || tx.TransactionType;
    const destination = transaction?.Destination || tx.Destination;

    if (txType === 'Payment' && destination === this.config.address) {
      // Extract transaction hash - in xrpl.js Client format, hash is at top level
      // Format: { hash: "...", Account: "...", Amount: "...", Destination: "...", meta: {...} }
      const txHash = tx.hash || transaction?.hash || transaction?.txid;
      const account = transaction?.Account || tx.Account;
      const txAmount = transaction?.Amount || tx.Amount;

      // Extract destination tag (XRP payment identifier)
      // DestinationTag can be in transaction object or at top level
      const destinationTag =
        transaction?.DestinationTag || tx.DestinationTag || null;

      console.log(
        '[XRP WebSocket] Payment transaction to our address detected!',
        {
          hash: txHash,
          from: account,
          to: destination,
          destinationTag, // Include destination tag in logs
          amount: txAmount,
          delivered_amount: meta?.delivered_amount,
          validated,
          ledger_index: ledgerIndex
        }
      );

      if (!txHash) {
        console.error(
          '[XRP WebSocket] Transaction hash not found! Cannot process payment. Full transaction:',
          {
            tx: JSON.stringify(tx, null, 2).substring(0, 1000),
            transaction: JSON.stringify(transaction, null, 2).substring(
              0,
              1000
            ),
            meta: meta ? JSON.stringify(meta, null, 2).substring(0, 500) : null
          }
        );
        return;
      }

      // Check if transaction succeeded
      if (meta && meta.TransactionResult !== 'tesSUCCESS') {
        console.log(
          '[XRP WebSocket] Transaction failed:',
          meta.TransactionResult
        );
        return;
      }

      // Get delivered amount (handles partial payments and currency conversions)
      // Use delivered_amount from meta if available (actual amount received)
      // Otherwise fall back to transaction.Amount (requested amount)
      let amountDrops = 0;
      if (meta && meta.delivered_amount) {
        // delivered_amount is the actual amount received (handles partial payments)
        amountDrops =
          typeof meta.delivered_amount === 'string'
            ? parseFloat(meta.delivered_amount)
            : meta.delivered_amount;
      } else if (txAmount) {
        // Fallback to requested amount
        amountDrops =
          typeof txAmount === 'string' ? parseFloat(txAmount) : txAmount;
      }

      // Convert drops to XRP (1 XRP = 1,000,000 drops)
      const amount = amountDrops / 1000000;

      const xrpTransaction: XRPTransaction = {
        hash: txHash,
        amount: amount.toString(),
        from: account,
        to: destination,
        destinationTag:
          destinationTag !== null && destinationTag !== undefined
            ? destinationTag
            : undefined,
        ledgerIndex:
          ledgerIndex || transaction?.ledger_index || tx.ledger_index,
        timestamp:
          transaction?.date || tx.date
            ? Math.floor(
                new Date(transaction?.date || tx.date).getTime() / 1000
              )
            : undefined,
        validated: true
      };

      console.log('[XRP WebSocket] Transaction received:', {
        hash: xrpTransaction.hash,
        amount: xrpTransaction.amount,
        from: xrpTransaction.from,
        to: xrpTransaction.to,
        destinationTag: xrpTransaction.destinationTag
      });
      this.config.onTransaction(xrpTransaction);
    }
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect(): Promise<void> {
    this.isIntentionallyClosed = true;
    this.isConnecting = false;

    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    // Disconnect client
    if (this.client) {
      try {
        if (this.client.isConnected()) {
          await this.client.disconnect();
        }
      } catch (error) {
        console.log('[XRP WebSocket] Error disconnecting:', error);
      }
      this.client = null;
    }

    console.log('[XRP WebSocket] Disconnected intentionally');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.client !== null && this.client.isConnected();
  }
}

/**
 * Create and manage XRP WebSocket monitor using official xrpl library
 */
export function createXRPWebSocketMonitor(
  config: XRPWebSocketConfig
): XRPWebSocketMonitor {
  return new XRPWebSocketMonitor(config);
}

/**
 * Check if WebSocket is available (browser environment)
 * Note: xrpl library works in both browser and Node.js
 */
export function isWebSocketAvailable(): boolean {
  // xrpl library handles WebSocket internally, so we just check if we're in a supported environment
  return typeof window !== 'undefined' || typeof global !== 'undefined';
}
