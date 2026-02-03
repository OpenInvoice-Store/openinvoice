'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Copy, Check, ExternalLink, TestTube } from 'lucide-react';
import { toast } from 'sonner';
// QR Code generation - install with: npm install qrcode @types/qrcode
// For now, using a QR code API service as fallback
let QRCode: any = null;
if (typeof window !== 'undefined') {
  try {
    QRCode = require('qrcode');
  } catch {
    // QRCode not installed, will use API fallback
  }
}
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  createXRPWebSocketMonitor,
  isWebSocketAvailable
} from '@/lib/crypto/xrp-websocket';

interface CryptoPaymentFormProps {
  invoiceId: string;
  amount: number;
  onSuccess?: () => void;
}

const SUPPORTED_CRYPTOS = [{ value: 'xrp', label: 'Ripple (XRP)' }];

interface CryptoPaymentData {
  paymentId: string;
  cryptoPaymentId: string;
  cryptocurrency: string;
  cryptoAmount: string;
  address: string;
  qrCode: string;
  expiresAt: string;
  minConfirmations: number;
  exchangeRate: number;
  fiatAmount: number;
  fiatCurrency: string;
  testMode?: boolean;
  testnet?: boolean;
}

interface PaymentStatus {
  status: 'pending' | 'confirmed' | 'underpaid' | 'expired';
  confirmed: boolean;
  confirmations: number;
  minConfirmations: number;
  transactionHash?: string;
  underpaid?: boolean;
  testMode?: boolean;
  testnet?: boolean;
}

export function CryptoPaymentForm({
  invoiceId,
  amount,
  onSuccess
}: CryptoPaymentFormProps) {
  const [selectedCrypto, setSelectedCrypto] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [paymentData, setPaymentData] = useState<CryptoPaymentData | null>(
    null
  );
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsMonitorRef = useRef<ReturnType<
    typeof createXRPWebSocketMonitor
  > | null>(null);
  const wsSetupRef = useRef<string | null>(null); // Track which address we've set up WebSocket for
  const wsFailedRef = useRef<boolean>(false); // Track if WebSocket has failed (to prevent retries)

  // Storage key for persisting payment data
  const storageKey = `crypto-payment-${invoiceId}`;

  const checkPaymentStatus = useCallback(
    async (
      currentPaymentData: CryptoPaymentData | null,
      options?: {
        actualCryptoAmount?: string;
        transactionHash?: string;
      }
    ) => {
      if (!currentPaymentData) return;

      try {
        // Use public endpoint for invoice-based checking (works for public view)
        const response = await fetch(
          `/api/invoices/${invoiceId}/crypto-payment/check`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              cryptoPaymentId: currentPaymentData.cryptoPaymentId,
              ...(options?.actualCryptoAmount && {
                actualCryptoAmount: options.actualCryptoAmount
              }),
              ...(options?.transactionHash && {
                transactionHash: options.transactionHash
              })
            })
          }
        );

        if (!response.ok) {
          // Fallback to authenticated endpoint if public endpoint fails
          try {
            const fallbackResponse = await fetch('/api/payments/crypto/check', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                paymentId: currentPaymentData.cryptoPaymentId,
                ...(options?.actualCryptoAmount && {
                  actualCryptoAmount: options.actualCryptoAmount
                }),
                ...(options?.transactionHash && {
                  transactionHash: options.transactionHash
                })
              })
            });

            if (fallbackResponse.ok) {
              const status: PaymentStatus = await fallbackResponse.json();
              setPaymentStatus(status);

              if (status.confirmed) {
                // Clean up polling
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current);
                  pollingIntervalRef.current = null;
                }
                // Clean up WebSocket
                if (wsMonitorRef.current) {
                  wsMonitorRef.current.disconnect();
                  wsMonitorRef.current = null;
                }
                localStorage.removeItem(storageKey);
                toast.success('Payment confirmed!');
                onSuccess?.();
              }
              return;
            }
          } catch (fallbackError) {
            console.log('Fallback endpoint also failed:', fallbackError);
          }
          throw new Error('Failed to check payment status');
        }

        const status: PaymentStatus = await response.json();
        setPaymentStatus(status);

        if (status.confirmed) {
          // Clean up polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          // Clean up WebSocket
          if (wsMonitorRef.current) {
            wsMonitorRef.current.disconnect();
            wsMonitorRef.current = null;
          }
          localStorage.removeItem(storageKey);
          toast.success('Payment confirmed!');
          onSuccess?.();
        }
      } catch (error) {
        console.log('Error checking payment status:', error);
      }
    },
    [invoiceId, storageKey, onSuccess]
  );

  // Restore payment data from localStorage on mount
  useEffect(() => {
    const restorePaymentData = async () => {
      try {
        // Check localStorage for saved payment
        const savedPaymentId = localStorage.getItem(storageKey);
        if (savedPaymentId) {
          // Try to fetch payment data from public API
          try {
            const response = await fetch(
              `/api/invoices/${invoiceId}/crypto-payment?cryptoPaymentId=${savedPaymentId}`
            );
            if (response.ok) {
              const data: CryptoPaymentData = await response.json();
              setPaymentData(data);
              // Check status immediately with the fetched data
              await checkPaymentStatus(data);
            } else {
              // Payment might be expired or confirmed, clear storage
              localStorage.removeItem(storageKey);
            }
          } catch (error) {
            console.log('Error restoring payment data:', error);
            // Try to get latest pending payment
            try {
              const response = await fetch(
                `/api/invoices/${invoiceId}/crypto-payment`
              );
              if (response.ok) {
                const data: CryptoPaymentData = await response.json();
                setPaymentData(data);
                localStorage.setItem(storageKey, data.cryptoPaymentId);
                await checkPaymentStatus(data);
              }
            } catch (err) {
              console.log('Error fetching latest payment:', err);
            }
          }
        } else {
          // Try to get latest pending payment for this invoice
          try {
            const response = await fetch(
              `/api/invoices/${invoiceId}/crypto-payment`
            );
            if (response.ok) {
              const data: CryptoPaymentData = await response.json();
              setPaymentData(data);
              localStorage.setItem(storageKey, data.cryptoPaymentId);
              await checkPaymentStatus(data);
            }
          } catch (error) {
            // No pending payment found, that's okay
            console.log('No pending payment found');
          }
        }
      } catch (error) {
        console.log('Error restoring payment:', error);
      } finally {
        setIsRestoring(false);
      }
    };

    restorePaymentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId]);

  // Save payment data to localStorage when it changes
  useEffect(() => {
    if (paymentData?.cryptoPaymentId) {
      localStorage.setItem(storageKey, paymentData.cryptoPaymentId);
    }
  }, [paymentData, storageKey]);

  // Clear localStorage when payment is confirmed
  useEffect(() => {
    if (paymentStatus?.confirmed) {
      localStorage.removeItem(storageKey);
    }
  }, [paymentStatus, storageKey]);

  // Generate QR code when payment data is available
  useEffect(() => {
    if (paymentData?.qrCode) {
      if (QRCode) {
        // Use qrcode library if available
        QRCode.toDataURL(paymentData.qrCode)
          .then((url: string) => {
            setQrCodeDataUrl(url);
          })
          .catch((err: any) => {
            console.log('Error generating QR code:', err);
            // Fallback to API
            generateQRCodeAPI(paymentData.qrCode);
          });
      } else {
        // Fallback to QR code API
        generateQRCodeAPI(paymentData.qrCode);
      }
    }
  }, [paymentData]);

  const generateQRCodeAPI = (text: string) => {
    // Use a free QR code API service
    const encodedText = encodeURIComponent(text);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodedText}`;
    setQrCodeDataUrl(qrUrl);
  };

  // Use WebSocket for XRP, polling for other cryptos
  useEffect(() => {
    if (!paymentData || paymentStatus?.confirmed) {
      return;
    }

    const crypto = paymentData.cryptocurrency.toLowerCase();
    const addressKey = `${crypto}-${paymentData.address}`;

    // Use WebSocket for XRP (real-time updates)
    if (crypto === 'xrp' && isWebSocketAvailable()) {
      // If WebSocket already failed for this address, skip and use polling
      if (wsFailedRef.current && wsSetupRef.current === addressKey) {
        console.log(
          '[XRP] WebSocket previously failed for this address, using polling'
        );
        // Start polling if not already started
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(async () => {
            await checkPaymentStatus(paymentData);
          }, 5000);
        }
        return;
      }

      // Prevent multiple setups for the same address
      if (wsSetupRef.current === addressKey && wsMonitorRef.current) {
        console.log(
          '[XRP] WebSocket already set up for this address, skipping'
        );
        return;
      }

      console.log(
        '[XRP] Setting up WebSocket monitor for address:',
        paymentData.address
      );
      wsFailedRef.current = false; // Reset failure flag for new attempt

      // Clean up existing monitor first
      if (wsMonitorRef.current) {
        wsMonitorRef.current.disconnect().catch(() => {
          // Ignore disconnect errors during cleanup
        });
        wsMonitorRef.current = null;
      }

      // Mark that we're setting up for this address
      wsSetupRef.current = addressKey;

      // Create WebSocket monitor
      // Use paymentData.testnet which comes from the server and reflects the actual environment
      const monitor = createXRPWebSocketMonitor({
        address: paymentData.address,
        isTestnet: paymentData.testnet || false,
        onTransaction: async (tx) => {
          console.log('[XRP WebSocket] Transaction detected:', tx);

          // Always use the ACTUAL amount received from WebSocket
          const receivedAmount = parseFloat(tx.amount);

          // Check payment status via API, passing the ACTUAL transaction data
          // The API will update the payment with the actual amount received
          await checkPaymentStatus(paymentData, {
            actualCryptoAmount: receivedAmount.toString(),
            transactionHash: tx.hash
          });
        },
        onError: (error) => {
          console.warn(
            '[XRP WebSocket] Connection failed, falling back to polling:',
            error.message
          );
          // Mark as failed to prevent retries
          wsFailedRef.current = true;

          // Immediately fallback to polling on WebSocket error
          // Disconnect WebSocket to prevent further attempts
          if (wsMonitorRef.current) {
            wsMonitorRef.current.disconnect().catch(() => {
              // Ignore disconnect errors
            });
            wsMonitorRef.current = null;
          }

          // Start polling instead
          if (!pollingIntervalRef.current) {
            console.log('[XRP] Using polling instead of WebSocket');
            pollingIntervalRef.current = setInterval(async () => {
              await checkPaymentStatus(paymentData);
            }, 5000);
          }
        }
      });

      wsMonitorRef.current = monitor;

      // Connect asynchronously
      monitor.connect().catch((error) => {
        console.log('[XRP WebSocket] Connection error:', error);
        // Error handler will be called by the monitor
      });

      // Also do an initial check
      checkPaymentStatus(paymentData);

      return () => {
        if (wsMonitorRef.current) {
          wsMonitorRef.current.disconnect().catch((error) => {
            console.log('[XRP WebSocket] Error during cleanup:', error);
          });
          wsMonitorRef.current = null;
        }
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
        wsSetupRef.current = null;
      };
    } else {
      // Use polling for other cryptocurrencies or if WebSocket unavailable
      pollingIntervalRef.current = setInterval(async () => {
        await checkPaymentStatus(paymentData);
      }, 5000);

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentData, checkPaymentStatus]);

  const handleCreatePayment = async () => {
    if (!selectedCrypto) {
      toast.error('Please select a cryptocurrency');
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch('/api/payments/crypto/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          invoiceId,
          cryptocurrency: selectedCrypto,
          amount
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create crypto payment');
      }

      const data: CryptoPaymentData = await response.json();
      setPaymentData(data);
      // Save to localStorage
      localStorage.setItem(storageKey, data.cryptoPaymentId);

      // Check status immediately with the new data
      await checkPaymentStatus(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create payment');
      setIsCreating(false);
    }
  };

  const copyAddress = async () => {
    if (!paymentData) return;

    try {
      await navigator.clipboard.writeText(paymentData.address);
      setCopied(true);
      toast.success('Address copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy address');
    }
  };

  const getExplorerUrl = (hash: string, crypto: string) => {
    const isTestnet = paymentData?.testnet || false;
    const isTestMode = paymentData?.testMode || false;

    if (isTestMode && hash.startsWith('test_')) {
      return `#test-transaction-${hash}`;
    }

    switch (crypto.toLowerCase()) {
      case 'xrp':
        return isTestnet
          ? `https://testnet.xrpl.org/transactions/${hash}`
          : `https://xrpscan.com/tx/${hash}`;
      default:
        return `https://blockchair.com/${crypto}/transaction/${hash}`;
    }
  };

  // Show loading state while restoring
  if (isRestoring) {
    return (
      <Card className='w-full'>
        <CardContent className='pt-6'>
          <div className='flex items-center justify-center py-4'>
            <Loader2 className='h-6 w-6 animate-spin' />
            <span className='text-muted-foreground ml-2 text-sm'>
              Loading payment information...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (paymentData) {
    return (
      <Card className='w-full'>
        <CardContent className='pt-6'>
          <div className='space-y-4'>
            {(paymentData.testMode || paymentData.testnet) && (
              <Alert className='border-yellow-500 bg-yellow-50 dark:bg-yellow-950'>
                <TestTube className='h-4 w-4 text-yellow-600' />
                <AlertDescription className='text-yellow-800 dark:text-yellow-200'>
                  {paymentData.testMode
                    ? '🧪 TEST MODE: Transactions are simulated. No real payment required.'
                    : '🧪 TESTNET MODE: Using testnet networks. No real funds required.'}
                </AlertDescription>
              </Alert>
            )}

            <div className='text-center'>
              <div className='flex items-center justify-center gap-2'>
                <h3 className='text-lg font-semibold'>
                  Pay {paymentData.cryptoAmount} {paymentData.cryptocurrency}
                </h3>
                {paymentData.testMode && (
                  <Badge
                    variant='outline'
                    className='bg-yellow-100 text-yellow-800'
                  >
                    TEST
                  </Badge>
                )}
                {paymentData.testnet && !paymentData.testMode && (
                  <Badge
                    variant='outline'
                    className='bg-blue-100 text-blue-800'
                  >
                    TESTNET
                  </Badge>
                )}
              </div>
              <p className='text-muted-foreground text-sm'>
                ≈ ${paymentData.fiatAmount.toFixed(2)}{' '}
                {paymentData.fiatCurrency}
              </p>
            </div>

            {qrCodeDataUrl && (
              <div className='flex justify-center'>
                <img
                  src={qrCodeDataUrl}
                  alt='Payment QR Code'
                  className='h-48 w-48 rounded border'
                />
              </div>
            )}

            <div className='space-y-2'>
              <label className='text-sm font-medium'>Payment Address</label>
              <div className='flex items-center gap-2'>
                <code className='bg-muted flex-1 rounded p-2 text-xs break-all'>
                  {paymentData.address}
                </code>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={copyAddress}
                  className='shrink-0'
                >
                  {copied ? (
                    <Check className='h-4 w-4' />
                  ) : (
                    <Copy className='h-4 w-4' />
                  )}
                </Button>
              </div>
            </div>

            {paymentStatus && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between text-sm'>
                  <span>Status:</span>
                  <span
                    className={`font-medium ${
                      paymentStatus.confirmed
                        ? 'text-green-600'
                        : paymentStatus.status === 'expired'
                          ? 'text-red-600'
                          : 'text-yellow-600'
                    }`}
                  >
                    {paymentStatus.status === 'confirmed'
                      ? 'Confirmed'
                      : paymentStatus.status === 'expired'
                        ? 'Expired'
                        : paymentStatus.status === 'underpaid'
                          ? 'Underpaid'
                          : 'Pending'}
                  </span>
                </div>

                {!paymentStatus.confirmed &&
                  paymentStatus.status !== 'expired' && (
                    <div className='flex items-center justify-between text-sm'>
                      <span>Confirmations:</span>
                      <span className='font-medium'>
                        {paymentStatus.confirmations} /{' '}
                        {paymentStatus.minConfirmations}
                      </span>
                    </div>
                  )}

                {paymentStatus.transactionHash && (
                  <div className='flex items-center justify-between text-sm'>
                    <span>Transaction:</span>
                    <a
                      href={getExplorerUrl(
                        paymentStatus.transactionHash,
                        paymentData.cryptocurrency
                      )}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex items-center gap-1 text-blue-600 hover:underline'
                    >
                      View
                      <ExternalLink className='h-3 w-3' />
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className='text-muted-foreground text-center text-xs'>
              Expires: {new Date(paymentData.expiresAt).toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className='space-y-4'>
      <Select value={selectedCrypto} onValueChange={setSelectedCrypto}>
        <SelectTrigger>
          <SelectValue placeholder='Select cryptocurrency' />
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_CRYPTOS.map((crypto) => (
            <SelectItem key={crypto.value} value={crypto.value}>
              {crypto.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        onClick={handleCreatePayment}
        disabled={!selectedCrypto || isCreating}
        className='w-full'
      >
        {isCreating ? (
          <>
            <Loader2 className='mr-2 h-4 w-4 animate-spin' />
            Creating payment...
          </>
        ) : (
          `Pay with Crypto`
        )}
      </Button>
    </div>
  );
}
