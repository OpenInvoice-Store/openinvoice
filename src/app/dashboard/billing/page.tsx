'use client';

import { useState, useEffect } from 'react';
import PageContainer from '@/components/layout/page-container';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useOrganization } from '@clerk/nextjs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Info, CheckCircle2, XCircle, Loader2, Link2 } from 'lucide-react';
import { billingInfoContent } from '@/config/infoconfig';
import { toast } from 'sonner';
import { useMutation } from '@tanstack/react-query';
import {
  useStripeConnectStatus,
  useConnectStripe,
  useDisconnectStripe,
  useEnableStripePayments
} from '@/features/invoicing/hooks/use-stripe';

interface StripeConnectStatus {
  connected: boolean;
  accountId?: string;
  status?: string;
  email?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  connectEnabled?: boolean;
}

export default function BillingPage() {
  const { organization, isLoaded } = useOrganization();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: stripeStatus, isLoading: isLoadingStatus } =
    useStripeConnectStatus(!!organization);
  const connectStripe = useConnectStripe();
  const disconnectStripe = useDisconnectStripe();
  const enableStripe = useEnableStripePayments();

  const handleConnect = () => {
    connectStripe.mutate(undefined, {
      onSuccess: (data) => {
        if (data.url) {
          window.location.href = data.url;
        }
        setIsConnecting(true);
      }
    });
  };

  // Hard reset Stripe mutation (delete account and clear connection)
  // Note: This is a special case that's not in the hook, keeping it inline
  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/connect/reset', {
        method: 'POST'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset Stripe');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success(
        'Stripe account reset successfully. You will need to redo Stripe onboarding next time you connect.'
      );
      // Invalidate queries - we'll need to import useQueryClient for this
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reset Stripe account');
    }
  });

  // Check if we're returning from Stripe OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_connected') === 'true') {
      toast.success('Stripe account connected successfully!');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className='bg-green-500'>
            <CheckCircle2 className='mr-1 h-3 w-3' />
            Active
          </Badge>
        );
      case 'pending':
        return (
          <Badge className='bg-yellow-500'>
            <Loader2 className='mr-1 h-3 w-3 animate-spin' />
            Pending
          </Badge>
        );
      case 'incomplete':
        return (
          <Badge className='bg-orange-500'>
            <Info className='mr-1 h-3 w-3' />
            Incomplete
          </Badge>
        );
      default:
        return (
          <Badge variant='outline'>
            <XCircle className='mr-1 h-3 w-3' />
            Not Connected
          </Badge>
        );
    }
  };

  return (
    <PageContainer
      isloading={!isLoaded || isLoadingStatus}
      access={!!organization}
      accessFallback={
        <div className='flex min-h-[400px] items-center justify-center'>
          <div className='space-y-2 text-center'>
            <h2 className='text-2xl font-semibold'>No Organization Selected</h2>
            <p className='text-muted-foreground'>
              Please select or create an organization to view billing
              information.
            </p>
          </div>
        </div>
      }
      infoContent={billingInfoContent}
      pageTitle='Billing & Plans'
      pageDescription={`Manage your subscription and payment settings for ${organization?.name}`}
    >
      <div className='space-y-6'>
        {/* Stripe Connect Card */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle>Payment Processing</CardTitle>
                <CardDescription>
                  Connect your Stripe account to accept online payments from
                  customers
                </CardDescription>
              </div>
              {getStatusBadge(stripeStatus?.status)}
            </div>
          </CardHeader>
          <CardContent className='space-y-4'>
            {stripeStatus?.connected ? (
              <div className='space-y-4'>
                <div className='bg-muted/50 rounded-lg border p-4'>
                  <div className='space-y-2'>
                    <div className='flex items-center justify-between'>
                      <span className='text-sm font-medium'>
                        Account Status
                      </span>
                      {getStatusBadge(stripeStatus.status)}
                    </div>
                    {stripeStatus.accountId && (
                      <div className='flex items-center justify-between'>
                        <span className='text-muted-foreground text-sm'>
                          Account ID
                        </span>
                        <span className='font-mono text-xs'>
                          {stripeStatus.accountId}
                        </span>
                      </div>
                    )}
                    {stripeStatus.email && (
                      <div className='flex items-center justify-between'>
                        <span className='text-muted-foreground text-sm'>
                          Email
                        </span>
                        <span className='text-sm'>{stripeStatus.email}</span>
                      </div>
                    )}
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground text-sm'>
                        Charges Enabled
                      </span>
                      {stripeStatus.chargesEnabled ? (
                        <CheckCircle2 className='h-4 w-4 text-green-500' />
                      ) : (
                        <XCircle className='h-4 w-4 text-red-500' />
                      )}
                    </div>
                    <div className='flex items-center justify-between'>
                      <span className='text-muted-foreground text-sm'>
                        Payouts Enabled
                      </span>
                      {stripeStatus.payoutsEnabled ? (
                        <CheckCircle2 className='h-4 w-4 text-green-500' />
                      ) : (
                        <XCircle className='h-4 w-4 text-red-500' />
                      )}
                    </div>
                  </div>
                </div>

                {!stripeStatus.payoutsEnabled && stripeStatus.connected && (
                  <Alert variant='default'>
                    <Info className='h-4 w-4' />
                    <AlertDescription>
                      Payouts are not yet enabled for your Stripe account. To
                      enable payouts, please complete your Stripe account
                      verification and add a bank account in your{' '}
                      <a
                        href='https://dashboard.stripe.com/account'
                        target='_blank'
                        rel='noopener noreferrer'
                        className='font-medium underline hover:no-underline'
                      >
                        Stripe Dashboard
                      </a>
                      . This is required to receive payments from customers.
                    </AlertDescription>
                  </Alert>
                )}

                {stripeStatus.status === 'active' ? (
                  <Alert>
                    <CheckCircle2 className='h-4 w-4' />
                    <AlertDescription>
                      {stripeStatus.connectEnabled
                        ? 'Your Stripe account is connected and ready to accept payments. Customers can now pay invoices online using credit cards.'
                        : 'Your Stripe account is active in Stripe, but payments are currently disabled for this organization in Open Invoice.'}
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant='default'>
                    <Info className='h-4 w-4' />
                    <AlertDescription>
                      Your Stripe account connection is pending. Please complete
                      the onboarding process to start accepting payments.
                    </AlertDescription>
                  </Alert>
                )}

                <div className='flex flex-wrap gap-2'>
                  <Button
                    variant='outline'
                    onClick={handleConnect}
                    disabled={connectStripe.isPending}
                  >
                    <Link2 className='mr-2 h-4 w-4' />
                    Update Connection
                  </Button>
                  {stripeStatus.connectEnabled ? (
                    <Button
                      variant='destructive'
                      onClick={() => {
                        if (
                          confirm(
                            'Are you sure you want to disconnect Stripe payments for this organization? Your Stripe account will remain active in Stripe.'
                          )
                        ) {
                          disconnectStripe.mutate();
                        }
                      }}
                      disabled={disconnectStripe.isPending}
                    >
                      {disconnectStripe.isPending ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Disconnecting...
                        </>
                      ) : (
                        'Disconnect Payments'
                      )}
                    </Button>
                  ) : (
                    <Button
                      variant='outline'
                      onClick={() => {
                        if (
                          confirm(
                            'Reconnect Stripe payments for this organization? Your existing Stripe account will be used.'
                          )
                        ) {
                          enableStripe.mutate();
                        }
                      }}
                      disabled={enableStripe.isPending}
                    >
                      {enableStripe.isPending ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Reconnecting...
                        </>
                      ) : (
                        'Reconnect Payments'
                      )}
                    </Button>
                  )}
                  <Button
                    variant='outline'
                    onClick={() => {
                      if (
                        confirm(
                          'This will permanently reset your Stripe connection for this organization and delete the connected Stripe account. You will need to complete all Stripe onboarding steps again. This cannot be undone. Continue?'
                        )
                      ) {
                        resetMutation.mutate();
                      }
                    }}
                    disabled={resetMutation.isPending}
                  >
                    {resetMutation.isPending ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Resetting...
                      </>
                    ) : (
                      'Reset Stripe Account'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className='space-y-4'>
                <Alert>
                  <Info className='h-4 w-4' />
                  <AlertDescription>
                    Connect your Stripe account to enable online payments.
                    You'll be able to accept credit card payments directly from
                    your customers.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={handleConnect}
                  disabled={connectStripe.isPending || isConnecting}
                  className='w-full'
                >
                  {connectStripe.isPending || isConnecting ? (
                    <>
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className='mr-2 h-4 w-4' />
                      Connect Stripe Account
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legacy Billing Card (for Clerk Billing if needed) */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Management</CardTitle>
            <CardDescription>
              Manage your organization's subscription and usage limits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <Info className='h-4 w-4' />
              <AlertDescription>
                Subscription management through Clerk Billing is available.
                Contact support for subscription management.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
