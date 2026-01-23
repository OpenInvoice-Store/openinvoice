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
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface StripeConnectStatus {
  connected: boolean;
  accountId?: string;
  status?: string;
  email?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
}

export default function BillingPage() {
  const { organization, isLoaded } = useOrganization();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Fetch Stripe Connect status
  const { data: stripeStatus, isLoading: isLoadingStatus } =
    useQuery<StripeConnectStatus>({
      queryKey: ['stripe-connect-status'],
      queryFn: async () => {
        const response = await fetch('/api/stripe/connect/status');
        if (!response.ok) {
          throw new Error('Failed to fetch Stripe status');
        }
        return response.json();
      },
      enabled: !!organization,
      refetchInterval: 5000 // Poll every 5 seconds when connecting
    });

  // Connect Stripe mutation
  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/connect/authorize');
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to connect Stripe');
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
      setIsConnecting(true);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to connect Stripe account');
    }
  });

  // Disconnect Stripe mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/connect/disconnect', {
        method: 'POST'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to disconnect Stripe');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Stripe account disconnected successfully');
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to disconnect Stripe account');
    }
  });

  // Check if we're returning from Stripe OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('stripe_connected') === 'true') {
      toast.success('Stripe account connected successfully!');
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [queryClient]);

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
                      Your Stripe account is connected and ready to accept
                      payments. Customers can now pay invoices online using
                      credit cards.
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

                <div className='flex gap-2'>
                  <Button
                    variant='outline'
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
                  >
                    <Link2 className='mr-2 h-4 w-4' />
                    Update Connection
                  </Button>
                  <Button
                    variant='destructive'
                    onClick={() => {
                      if (
                        confirm(
                          'Are you sure you want to disconnect your Stripe account?'
                        )
                      ) {
                        disconnectMutation.mutate();
                      }
                    }}
                    disabled={disconnectMutation.isPending}
                  >
                    {disconnectMutation.isPending ? (
                      <>
                        <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                        Disconnecting...
                      </>
                    ) : (
                      'Disconnect'
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
                  onClick={() => connectMutation.mutate()}
                  disabled={connectMutation.isPending || isConnecting}
                  className='w-full'
                >
                  {connectMutation.isPending || isConnecting ? (
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
