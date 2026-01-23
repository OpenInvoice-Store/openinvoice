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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  CreditCard,
  Settings
} from 'lucide-react';
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

export default function SettingsPage() {
  const { organization, isLoaded } = useOrganization();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Common countries supported by Stripe (ISO 2-letter codes)
  const supportedCountries = [
    { code: 'US', name: 'United States' },
    { code: 'CA', name: 'Canada' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'AU', name: 'Australia' },
    { code: 'NZ', name: 'New Zealand' },
    { code: 'IE', name: 'Ireland' },
    { code: 'FR', name: 'France' },
    { code: 'DE', name: 'Germany' },
    { code: 'IT', name: 'Italy' },
    { code: 'ES', name: 'Spain' },
    { code: 'NL', name: 'Netherlands' },
    { code: 'BE', name: 'Belgium' },
    { code: 'AT', name: 'Austria' },
    { code: 'FI', name: 'Finland' },
    { code: 'SE', name: 'Sweden' },
    { code: 'NO', name: 'Norway' },
    { code: 'DK', name: 'Denmark' },
    { code: 'PL', name: 'Poland' },
    { code: 'PT', name: 'Portugal' },
    { code: 'CH', name: 'Switzerland' },
    { code: 'SG', name: 'Singapore' },
    { code: 'HK', name: 'Hong Kong' },
    { code: 'JP', name: 'Japan' },
    { code: 'MX', name: 'Mexico' },
    { code: 'BR', name: 'Brazil' }
  ];

  // Fetch organization country
  const { data: countryData } = useQuery({
    queryKey: ['organization-country'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/country');
      if (!response.ok) throw new Error('Failed to fetch country');
      return response.json();
    },
    enabled: !!organization
  });

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
      refetchInterval: (query) => {
        // Only poll when connecting or status is pending/incomplete
        const status = query.state.data?.status;
        return status === 'pending' || status === 'incomplete' ? 10000 : false; // Poll every 10 seconds when pending, otherwise disable
      }
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

  // Update country mutation
  const updateCountryMutation = useMutation({
    mutationFn: async (country: string) => {
      const response = await fetch('/api/organizations/country', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ country })
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update country');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('Country updated successfully');
      queryClient.invalidateQueries({ queryKey: ['organization-country'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update country');
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
              Please select or create an organization to view settings.
            </p>
          </div>
        </div>
      }
      pageTitle='Settings'
      pageDescription={`Manage your organization settings for ${organization?.name}`}
    >
      <div className='space-y-6'>
        <Tabs defaultValue='payments' className='w-full'>
          <TabsList>
            <TabsTrigger value='payments'>
              <CreditCard className='mr-2 h-4 w-4' />
              Payment Processing
            </TabsTrigger>
            <TabsTrigger value='subscription'>
              <Settings className='mr-2 h-4 w-4' />
              Subscription
            </TabsTrigger>
          </TabsList>

          {/* Payment Processing Tab */}
          <TabsContent value='payments' className='space-y-6'>
            <Card>
              <CardHeader>
                <div className='flex items-center justify-between'>
                  <div>
                    <CardTitle>Stripe Payment Processing</CardTitle>
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
                            <span className='text-sm'>
                              {stripeStatus.email}
                            </span>
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
                          Payouts are not yet enabled for your Stripe account.
                          To enable payouts, please complete your Stripe account
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
                          Your Stripe account connection is pending. Please
                          complete the onboarding process to start accepting
                          payments.
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
                        You'll be able to accept credit card payments directly
                        from your customers. Payments will go directly to your
                        connected Stripe account.
                      </AlertDescription>
                    </Alert>

                    {/* Country Selection */}
                    <div className='space-y-2'>
                      <Label htmlFor='country'>
                        Country for Stripe Account
                      </Label>
                      <Select
                        value={
                          countryData?.country ||
                          process.env.NEXT_PUBLIC_STRIPE_DEFAULT_COUNTRY ||
                          'US'
                        }
                        onValueChange={(value) =>
                          updateCountryMutation.mutate(value)
                        }
                        disabled={
                          updateCountryMutation.isPending ||
                          !!stripeStatus?.connected
                        }
                      >
                        <SelectTrigger id='country'>
                          <SelectValue placeholder='Select country' />
                        </SelectTrigger>
                        <SelectContent>
                          {supportedCountries.map((country) => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name} ({country.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className='text-muted-foreground text-xs'>
                        {stripeStatus?.connected
                          ? 'Country cannot be changed after Stripe account is connected. Disconnect to change country.'
                          : 'Select your country before connecting your Stripe account. This determines which Stripe features are available.'}
                      </p>
                    </div>

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
          </TabsContent>

          {/* Subscription Tab */}
          <TabsContent value='subscription' className='space-y-6'>
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
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
