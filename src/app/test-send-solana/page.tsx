'use client';

import { useState, useEffect } from 'react';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  Transaction
} from '@solana/web3.js';
import {
  getAssociatedTokenAddress,
  getMint,
  createAssociatedTokenAccountInstruction,
  transfer
} from '@solana/spl-token';

// Solana mint addresses
const MINTS = {
  testnet: {
    USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    SOL: 'So11111111111111111111111111111111111111112'
  },
  devnet: {
    USDC: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    SOL: 'So11111111111111111111111111111111111111112'
  }
};

const RPC_URLS = {
  testnet: 'https://api.testnet.solana.com',
  devnet: 'https://api.devnet.solana.com'
};

export default function TestSolanaPaymentPage() {
  const [network, setNetwork] = useState<'testnet' | 'devnet'>('testnet');
  const [senderPrivateKey, setSenderPrivateKey] = useState('');
  const [senderAddress, setSenderAddress] = useState('');
  const [senderBalance, setSenderBalance] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [tokenType, setTokenType] = useState<'SOL' | 'USDC' | 'USDT'>('SOL');
  const [amount, setAmount] = useState('1.0');
  const [isConnected, setIsConnected] = useState(false);
  const [result, setResult] = useState<{
    type: 'success' | 'error';
    message: string;
    details?: any;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const [connection, setConnection] = useState<Connection | null>(null);
  const [senderWallet, setSenderWallet] = useState<Keypair | null>(null);

  useEffect(() => {
    // Initialize connection
    const rpcUrl = RPC_URLS[network];
    const conn = new Connection(rpcUrl, 'confirmed');
    setConnection(conn);
    setIsConnected(true);
  }, [network]);

  const getSenderAccount = async () => {
    if (!connection) return;

    setLoading(true);
    setResult(null);

    try {
      if (!senderPrivateKey.trim()) {
        // Generate new account only if private key is empty
        setResult({ type: 'success', message: 'Generating new account...' });

        const newKeypair = Keypair.generate();
        setSenderWallet(newKeypair);

        // Request airdrop for testnet/devnet
        setResult({
          type: 'success',
          message: 'Requesting airdrop (this may take a moment)...'
        });
        try {
          const signature = await connection.requestAirdrop(
            newKeypair.publicKey,
            2 * LAMPORTS_PER_SOL // 2 SOL
          );
          await connection.confirmTransaction(signature, 'confirmed');
          setResult({
            type: 'success',
            message: 'Waiting for airdrop confirmation...'
          });
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (airdropError: any) {
          console.warn(
            'Airdrop failed (may need manual faucet):',
            airdropError
          );
          setResult({
            type: 'error',
            message:
              'Airdrop unavailable. Please use a faucet to fund this account, or use an existing funded account.'
          });
        }

        // Convert Uint8Array to base64
        const privateKeyBase64 = btoa(
          String.fromCharCode(...Array.from(newKeypair.secretKey))
        );
        setSenderPrivateKey(privateKeyBase64);

        const balance = await connection.getBalance(newKeypair.publicKey);
        const balanceSOL = balance / LAMPORTS_PER_SOL;
        setSenderBalance(balanceSOL.toFixed(4));
        setSenderAddress(newKeypair.publicKey.toString());

        setResult({
          type: 'success',
          message:
            '✓ Account generated successfully! Private key has been filled in automatically.'
        });
      } else {
        // Refresh existing account info (don't regenerate)
        setResult({ type: 'success', message: 'Refreshing account info...' });

        try {
          // Convert base64 to Uint8Array
          const base64Decoded = atob(senderPrivateKey.trim());
          const privateKeyBytes = new Uint8Array(base64Decoded.length);
          for (let i = 0; i < base64Decoded.length; i++) {
            privateKeyBytes[i] = base64Decoded.charCodeAt(i);
          }
          const keypair = Keypair.fromSecretKey(privateKeyBytes);
          setSenderWallet(keypair);

          // Refresh balance and address
          const balance = await connection.getBalance(keypair.publicKey);
          const balanceSOL = balance / LAMPORTS_PER_SOL;
          setSenderBalance(balanceSOL.toFixed(4));
          setSenderAddress(keypair.publicKey.toString());

          setResult({
            type: 'success',
            message: `✓ Account refreshed! Balance: ${balanceSOL.toFixed(4)} SOL`
          });
        } catch (keyError: any) {
          throw new Error(
            'Invalid private key format. Please use Base64 encoded secret key.'
          );
        }
      }
    } catch (error: any) {
      setResult({ type: 'error', message: `Error: ${error.message}` });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendPayment = async () => {
    if (!connection || !senderWallet) {
      setResult({
        type: 'error',
        message: 'Please get a sender account first (Step 1)'
      });
      return;
    }

    if (!destinationAddress.trim()) {
      setResult({
        type: 'error',
        message: 'Please enter a destination token account address'
      });
      return;
    }

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      setResult({ type: 'error', message: 'Please enter a valid amount' });
      return;
    }

    setLoading(true);
    setResult({ type: 'success', message: 'Preparing transaction...' });

    try {
      const mintAddresses = MINTS[network];

      // Validate destination address
      let destinationPubkey: PublicKey;
      try {
        destinationPubkey = new PublicKey(destinationAddress.trim());
      } catch (error) {
        throw new Error('Invalid destination address format');
      }

      let signature: string;
      let transactionDetails: any = {};

      if (tokenType === 'SOL') {
        // Send native SOL
        setResult({ type: 'success', message: 'Preparing SOL transfer...' });

        // Check current balance first
        const currentBalance = await connection.getBalance(
          senderWallet.publicKey
        );
        const lamports = parseFloat(amount) * LAMPORTS_PER_SOL;

        // Estimate transaction fee (typically ~5000 lamports, but we'll get the actual fee)
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: senderWallet.publicKey,
            toPubkey: destinationPubkey,
            lamports: lamports
          })
        );

        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = senderWallet.publicKey;

        // Estimate fee
        const feeEstimate = await connection.getFeeForMessage(
          transaction.compileMessage(),
          'confirmed'
        );
        const estimatedFee = feeEstimate?.value || 5000; // Default to 5000 if estimation fails
        const totalRequired = lamports + estimatedFee;

        // Check if balance is sufficient
        if (currentBalance < totalRequired) {
          const availableSOL = currentBalance / LAMPORTS_PER_SOL;
          const requiredSOL = totalRequired / LAMPORTS_PER_SOL;
          const feeSOL = estimatedFee / LAMPORTS_PER_SOL;
          throw new Error(
            `Insufficient balance! You have ${availableSOL.toFixed(4)} SOL, but need ${requiredSOL.toFixed(4)} SOL (${amount} SOL + ${feeSOL.toFixed(4)} SOL fee). Please reduce the amount or add more SOL to your account.`
          );
        }

        // Sign and send
        setResult({
          type: 'success',
          message: 'Signing and sending transaction...'
        });
        signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [senderWallet],
          { commitment: 'confirmed' }
        );

        transactionDetails = {
          type: 'SOL',
          amount: amount,
          lamports: lamports
        };
      } else {
        // Send SPL token (USDC or USDT)
        const mintAddress = mintAddresses[tokenType];
        if (!mintAddress) {
          throw new Error(
            `Mint address not found for ${tokenType} on ${network}`
          );
        }

        setResult({
          type: 'success',
          message: `Preparing ${tokenType} transfer...`
        });

        const mintPubkey = new PublicKey(mintAddress);
        const senderTokenAccount = await getAssociatedTokenAddress(
          mintPubkey,
          senderWallet.publicKey
        );

        // Check if sender has token account, create if needed
        let senderTokenAccountInfo;
        try {
          senderTokenAccountInfo =
            await connection.getAccountInfo(senderTokenAccount);
        } catch (error) {
          // Account doesn't exist
        }

        if (!senderTokenAccountInfo) {
          setResult({
            type: 'success',
            message: `Creating ${tokenType} token account for sender...`
          });
          const createTx = new Transaction().add(
            createAssociatedTokenAccountInstruction(
              senderWallet.publicKey,
              senderTokenAccount,
              senderWallet.publicKey,
              mintPubkey
            )
          );

          const { blockhash } =
            await connection.getLatestBlockhash('confirmed');
          createTx.recentBlockhash = blockhash;
          createTx.feePayer = senderWallet.publicKey;

          await sendAndConfirmTransaction(
            connection,
            createTx,
            [senderWallet],
            { commitment: 'confirmed' }
          );
        }

        // Get token decimals
        const mintInfo = await getMint(connection, mintPubkey);
        const tokenAmount =
          parseFloat(amount) * Math.pow(10, mintInfo.decimals);

        // Check SOL balance for transaction fees (SPL token transfers still need SOL for fees)
        const currentBalance = await connection.getBalance(
          senderWallet.publicKey
        );
        const estimatedFee = 5000; // SPL token transfer fee is typically ~5000 lamports

        if (currentBalance < estimatedFee) {
          const availableSOL = currentBalance / LAMPORTS_PER_SOL;
          const feeSOL = estimatedFee / LAMPORTS_PER_SOL;
          throw new Error(
            `Insufficient SOL for transaction fees! You have ${availableSOL.toFixed(6)} SOL, but need at least ${feeSOL.toFixed(6)} SOL for transaction fees. Please add more SOL to your account.`
          );
        }

        // Transfer tokens
        setResult({ type: 'success', message: `Transferring ${tokenType}...` });
        signature = await transfer(
          connection,
          senderWallet,
          senderTokenAccount,
          destinationPubkey,
          senderWallet.publicKey,
          BigInt(Math.floor(tokenAmount)),
          [],
          { commitment: 'confirmed' }
        );

        transactionDetails = {
          type: tokenType,
          amount: amount,
          tokenAmount: Math.floor(tokenAmount),
          decimals: mintInfo.decimals
        };
      }

      // Wait for confirmation
      setResult({ type: 'success', message: 'Waiting for confirmation...' });
      await connection.confirmTransaction(signature, 'confirmed');

      // Get transaction details
      const tx = await connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      // Update sender balance
      const newBalance = await connection.getBalance(senderWallet.publicKey);
      const balanceSOL = newBalance / LAMPORTS_PER_SOL;
      setSenderBalance(balanceSOL.toFixed(4));

      // Get explorer URL
      const explorerUrl = `https://explorer.solana.com/tx/${signature}?cluster=${network}`;

      setResult({
        type: 'success',
        message: '✓ Transaction Successful!',
        details: {
          signature,
          tokenType: transactionDetails.type,
          amount: transactionDetails.amount,
          slot: tx?.slot || 'N/A',
          newBalance: balanceSOL.toFixed(4),
          explorerUrl
        }
      });
    } catch (error: any) {
      setResult({
        type: 'error',
        message: `✗ Transaction Failed: ${error.message}`,
        details: error.logs ? { logs: error.logs } : undefined
      });
      console.error('Transaction error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-gray-50 px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto max-w-4xl'>
        <div className='mb-6 rounded-lg bg-white p-8 shadow-md'>
          <h1 className='mb-2 border-b-4 border-green-400 pb-2 text-3xl font-bold text-gray-900'>
            Test Solana Payment Sender
          </h1>
          <p className='mb-4 text-gray-600'>
            Use this tool to send test Solana payments (SOL, USDC, USDT) to your
            generated token account address from settings.
          </p>
          <p className='text-sm'>
            Connection Status:{' '}
            <span
              className={`inline-block rounded px-3 py-1 font-bold ${
                isConnected
                  ? 'bg-green-500 text-white'
                  : 'bg-red-500 text-white'
              }`}
            >
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </p>
        </div>

        <div className='mb-6 rounded-lg bg-white p-8 shadow-md'>
          <h3 className='mb-4 text-xl font-semibold text-green-500'>
            Step 1: Get Sender Account
          </h3>
          <div className='space-y-4'>
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Network:
              </label>
              <select
                value={network}
                onChange={(e) =>
                  setNetwork(e.target.value as 'testnet' | 'devnet')
                }
                className='w-full rounded-md border border-gray-300 px-4 py-2 focus:border-green-500 focus:ring-green-500'
              >
                <option value='testnet'>Testnet</option>
                <option value='devnet'>Devnet</option>
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Sender Private Key (Base64):
              </label>
              <input
                type='text'
                value={senderPrivateKey}
                onChange={(e) => setSenderPrivateKey(e.target.value)}
                placeholder='Enter private key (Base64) or leave empty to generate new account'
                className='w-full rounded-md border border-gray-300 px-4 py-2 font-mono text-sm focus:border-green-500 focus:ring-green-500'
              />
            </div>

            <button
              onClick={getSenderAccount}
              disabled={loading || !connection}
              className='w-full rounded-md bg-green-400 px-6 py-3 font-bold text-black transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300'
            >
              {loading
                ? 'Loading...'
                : senderPrivateKey.trim()
                  ? 'Refresh Account Info'
                  : 'Generate New Account'}
            </button>
            {senderPrivateKey.trim() && (
              <p className='mt-1 text-xs text-gray-500'>
                ℹ️ Clicking will refresh your current account balance, not
                generate a new one. Your private key and address will remain the
                same.
              </p>
            )}

            {senderAddress && (
              <div className='rounded border-l-4 border-blue-400 bg-blue-50 p-4'>
                <p className='text-sm'>
                  <strong>Address:</strong>{' '}
                  <span className='font-mono break-all'>{senderAddress}</span>
                </p>
                <p className='text-sm'>
                  <strong>Balance:</strong> {senderBalance} SOL
                </p>
              </div>
            )}
          </div>
        </div>

        <div className='mb-6 rounded-lg bg-white p-8 shadow-md'>
          <h3 className='mb-4 text-xl font-semibold text-green-500'>
            Step 2: Send Payment
          </h3>
          <div className='space-y-4'>
            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Token Type:
              </label>
              <select
                value={tokenType}
                onChange={(e) =>
                  setTokenType(e.target.value as 'SOL' | 'USDC' | 'USDT')
                }
                className='w-full rounded-md border border-gray-300 px-4 py-2 focus:border-green-500 focus:ring-green-500'
              >
                <option value='SOL'>SOL (Native Solana)</option>
                <option value='USDC'>USDC (USD Coin)</option>
                <option value='USDT'>USDT (Tether)</option>
              </select>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Destination Token Account Address:
              </label>
              <input
                type='text'
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                placeholder='Paste the token account address from the invoice payment form'
                className='w-full rounded-md border border-gray-300 px-4 py-2 font-mono text-sm focus:border-green-500 focus:ring-green-500'
              />
              <p className='mt-1 text-xs text-gray-500'>
                ⚠️ This should be the Associated Token Account (ATA) address,
                not the wallet address. The ATA address is displayed in the
                invoice payment form.
              </p>
            </div>

            <div>
              <label className='mb-2 block text-sm font-medium text-gray-700'>
                Amount:
              </label>
              <input
                type='text'
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder='1.0'
                className='w-full rounded-md border border-gray-300 px-4 py-2 focus:border-green-500 focus:ring-green-500'
              />
              <p className='mt-1 text-xs text-gray-500'>
                Enter the amount to send (will be converted based on token
                decimals)
              </p>
            </div>

            <button
              onClick={sendPayment}
              disabled={loading || !connection || !senderWallet}
              className='w-full rounded-md bg-green-400 px-6 py-3 font-bold text-black transition-colors hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-gray-300'
            >
              {loading ? 'Sending...' : 'Send Payment'}
            </button>
          </div>
        </div>

        {result && (
          <div
            className={`mb-6 rounded-lg border-l-4 p-6 ${
              result.type === 'success'
                ? 'border-green-400 bg-green-50 text-green-800'
                : 'border-red-400 bg-red-50 text-red-800'
            }`}
          >
            <div className='whitespace-pre-wrap'>{result.message}</div>
            {result.details && (
              <div className='mt-4 space-y-2'>
                {result.details.signature && (
                  <p className='text-sm'>
                    <strong>Transaction Signature:</strong>{' '}
                    <span className='font-mono break-all'>
                      {result.details.signature}
                    </span>
                  </p>
                )}
                {result.details.tokenType && (
                  <p className='text-sm'>
                    <strong>Token Type:</strong> {result.details.tokenType}
                  </p>
                )}
                {result.details.amount && (
                  <p className='text-sm'>
                    <strong>Amount Sent:</strong> {result.details.amount}{' '}
                    {result.details.tokenType}
                  </p>
                )}
                {result.details.slot && (
                  <p className='text-sm'>
                    <strong>Slot:</strong> {result.details.slot}
                  </p>
                )}
                {result.details.newBalance && (
                  <p className='text-sm'>
                    <strong>New Balance:</strong> {result.details.newBalance}{' '}
                    SOL
                  </p>
                )}
                {result.details.explorerUrl && (
                  <p className='text-sm'>
                    <strong>Explorer:</strong>{' '}
                    <a
                      href={result.details.explorerUrl}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='text-blue-600 hover:underline'
                    >
                      View Transaction
                    </a>
                  </p>
                )}
                {result.details.logs && (
                  <details className='mt-2'>
                    <summary className='cursor-pointer font-bold'>
                      Transaction Logs
                    </summary>
                    <pre className='mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs'>
                      {JSON.stringify(result.details.logs, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            )}
          </div>
        )}

        <div className='rounded-lg bg-white p-8 shadow-md'>
          <h3 className='mb-4 text-xl font-semibold text-gray-900'>
            Instructions
          </h3>
          <ol className='list-inside list-decimal space-y-2 text-gray-700'>
            <li>Go to your app Settings → Crypto Payment Settings</li>
            <li>Generate a Solana testnet address (or use an existing one)</li>
            <li>
              Create a crypto payment for an invoice (or view existing payment)
            </li>
            <li>
              Copy the <strong>Token Account Address</strong> from the invoice
              payment form
            </li>
            <li>
              Paste the address in the &quot;Destination Token Account
              Address&quot; field above
            </li>
            <li>Select the token type (SOL, USDC, or USDT)</li>
            <li>
              Click &quot;Get Account Info / Generate New&quot; to get a sender
              account (or use an existing private key)
            </li>
            <li>Enter the amount you want to send</li>
            <li>Click &quot;Send Payment&quot;</li>
            <li>
              Check your invoice payment form - the WebSocket should detect the
              transaction automatically!
            </li>
          </ol>
          <div className='mt-4 rounded bg-blue-50 p-4'>
            <p className='mb-2 text-sm font-semibold'>
              <strong>Note:</strong> For testnet/devnet, you can get free SOL
              from faucets:
            </p>
            <ul className='list-inside list-disc space-y-1 text-sm'>
              <li>
                Testnet:{' '}
                <a
                  href='https://faucet.solana.com/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline'
                >
                  https://faucet.solana.com/
                </a>
              </li>
              <li>
                Devnet:{' '}
                <a
                  href='https://faucet.solana.com/'
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-blue-600 hover:underline'
                >
                  https://faucet.solana.com/
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
