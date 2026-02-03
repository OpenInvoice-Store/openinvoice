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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Info,
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TaxProfileSettings } from '@/features/invoicing/components/tax-profile-settings';
import { CryptoPaymentSettings } from '@/features/invoicing/components/crypto-payment-settings';
import { useStripeConnectStatus } from '@/features/invoicing/hooks/use-stripe';
import { COUNTRIES } from '@/constants/countries';

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

export default function PaymentsSettingsPage() {
  const { organization, isLoaded } = useOrganization();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Use shared countries constant
  const supportedCountries = COUNTRIES;

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

  // Use existing hook for Stripe Connect status
  // Note: The hook has built-in polling, but this page needs custom polling logic
  // So we'll keep a custom query here for the specific refetchInterval behavior
  const { data: stripeStatus, isLoading: isLoadingStatus } =
    useStripeConnectStatus(!!organization);

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

  // Disconnect Stripe mutation (soft disconnect: disable payments in app)
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
      toast.success(
        'Stripe payments have been disconnected for this organization (Stripe account remains active).'
      );
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to disconnect Stripe account');
    }
  });

  // Enable Stripe payments mutation (reconnect in app)
  const enableMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/stripe/connect/enable', {
        method: 'POST'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to enable Stripe');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success(
        'Stripe payments have been re-enabled for this organization.'
      );
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to enable Stripe account');
    }
  });

  // Hard reset Stripe mutation (delete account and clear connection)
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
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reset Stripe account');
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
      pageTitle='Payment Processing'
      pageDescription='Connect your Stripe account to accept online payments from customers'
    >
      <div className='space-y-6 p-6'>
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
                    onClick={() => connectMutation.mutate()}
                    disabled={connectMutation.isPending}
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
                          enableMutation.mutate();
                        }
                      }}
                      disabled={enableMutation.isPending}
                    >
                      {enableMutation.isPending ? (
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
                    your customers. Payments will go directly to your connected
                    Stripe account.
                  </AlertDescription>
                </Alert>

                {/* Country Selection */}
                <div className='space-y-2'>
                  <Label htmlFor='country'>Country for Stripe Account</Label>
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

        {/* Crypto Payment Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Crypto Payments</CardTitle>
            <CardDescription>
              Accept payments in Bitcoin, Ethereum, and other cryptocurrencies
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CryptoPaymentSettings />
          </CardContent>
        </Card>

        {/* Tax Settings - Tab Navigation */}
        <Card>
          <CardHeader>
            <div className='flex items-center justify-between'>
              <div>
                <CardTitle className='flex items-center gap-2'>
                  <Receipt className='h-5 w-5' />
                  Tax Calculation
                </CardTitle>
                <CardDescription>
                  Configure automatic tax calculation services or create custom
                  tax profiles
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue='taxjar' className='w-full'>
              <TabsList className='grid w-full grid-cols-2'>
                <TabsTrigger value='taxjar'>TaxJar</TabsTrigger>
                <TabsTrigger value='profiles'>Tax Profiles</TabsTrigger>
              </TabsList>

              <TabsContent value='taxjar' className='mt-6'>
                <div className='space-y-4'>
                  <div className='mb-4'>
                    <h3 className='text-lg font-semibold'>
                      TaxJar Integration
                    </h3>
                    <p className='text-muted-foreground text-sm'>
                      Enable automatic tax calculation using TaxJar. Provides
                      accurate sales tax rates for US and international taxes.
                    </p>
                  </div>
                  <TaxJarSettings />
                </div>
              </TabsContent>

              <TabsContent value='profiles' className='mt-6'>
                <div className='space-y-4'>
                  <div className='mb-4'>
                    <h3 className='text-lg font-semibold'>Tax Profiles</h3>
                    <p className='text-muted-foreground text-sm'>
                      Create custom tax profiles with manual tax rates. Use
                      these when you need specific tax rules or when automatic
                      tax services aren't available.
                    </p>
                  </div>
                  <TaxProfileSettings />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}

// TaxJar Settings Component
function TaxJarSettings() {
  const queryClient = useQueryClient();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<boolean | null>(null);
  const [nexusRegions, setNexusRegions] = useState<
    Array<{
      country: string;
      state?: string;
      zip?: string;
      city?: string;
      street?: string;
    }>
  >([]);
  const [newNexusRegion, setNewNexusRegion] = useState({
    country: 'US',
    state: '',
    zip: '',
    city: '',
    street: ''
  });

  // Fetch TaxJar settings
  const { data: taxJarSettings, isLoading } = useQuery({
    queryKey: ['taxjar-settings'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/taxjar');
      if (!response.ok) throw new Error('Failed to fetch TaxJar settings');
      return response.json();
    }
  });

  // Fetch Stripe Tax settings to check mutual exclusion
  const { data: taxSettings } = useQuery({
    queryKey: ['stripe-tax-settings'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/stripe-tax');
      if (!response.ok) return { stripeTaxEnabled: false };
      return response.json();
    }
  });

  // Initialize nexus regions from settings
  useEffect(() => {
    if (taxJarSettings?.taxJarNexusRegions) {
      setNexusRegions(taxJarSettings.taxJarNexusRegions);
    }
  }, [taxJarSettings]);

  // Update TaxJar settings
  const updateTaxJarSettings = useMutation({
    mutationFn: async (data: {
      taxJarEnabled?: boolean;
      taxJarApiKey?: string;
      taxJarNexusRegions?: Array<{
        country: string;
        state?: string;
        zip?: string;
        city?: string;
        street?: string;
      }>;
    }) => {
      const response = await fetch('/api/organizations/taxjar', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update TaxJar settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxjar-settings'] });
      toast.success('TaxJar settings updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update TaxJar settings');
    }
  });

  const handleAddNexusRegion = () => {
    if (!newNexusRegion.country) {
      toast.error('Country is required');
      return;
    }
    const updated = [...nexusRegions, { ...newNexusRegion }];
    setNexusRegions(updated);
    updateTaxJarSettings.mutate({ taxJarNexusRegions: updated });
    setNewNexusRegion({
      country: 'US',
      state: '',
      zip: '',
      city: '',
      street: ''
    });
  };

  const handleRemoveNexusRegion = (index: number) => {
    const updated = nexusRegions.filter((_, i) => i !== index);
    setNexusRegions(updated);
    updateTaxJarSettings.mutate({ taxJarNexusRegions: updated });
  };

  if (isLoading) {
    return <div className='text-muted-foreground text-sm'>Loading...</div>;
  }

  return (
    <div className='space-y-4'>
      {taxSettings?.stripeTaxEnabled && (
        <Alert variant='default'>
          <Info className='h-4 w-4' />
          <AlertDescription>
            Stripe Tax is currently enabled. Enabling TaxJar will automatically
            disable Stripe Tax.
          </AlertDescription>
        </Alert>
      )}

      <div className='space-y-4'>
        <div className='flex items-center justify-between rounded-lg border p-4'>
          <div className='space-y-0.5'>
            <Label htmlFor='taxjar-enabled' className='text-base'>
              Enable TaxJar
            </Label>
            <p className='text-muted-foreground text-sm'>
              Automatically calculate accurate sales tax rates based on customer
              location
            </p>
          </div>
          <Switch
            id='taxjar-enabled'
            checked={taxJarSettings?.taxJarEnabled || false}
            disabled={updateTaxJarSettings.isPending}
            onCheckedChange={(checked) => {
              if (checked && taxSettings?.stripeTaxEnabled) {
                // Show confirmation dialog when Stripe Tax is enabled
                setPendingToggle(checked);
                setShowConfirmDialog(true);
              } else if (!checked) {
                // Allow disabling without confirmation
                updateTaxJarSettings.mutate({ taxJarEnabled: checked });
              } else {
                // Enable when Stripe Tax is not enabled
                updateTaxJarSettings.mutate({ taxJarEnabled: checked });
              }
            }}
          />
        </div>

        {taxJarSettings?.taxJarEnabled && (
          <>
            <div className='space-y-2'>
              <Label htmlFor='taxjar-api-key'>TaxJar API Key</Label>
              <Input
                id='taxjar-api-key'
                type='password'
                placeholder={
                  taxJarSettings?.hasApiKey
                    ? '••••••••••••••••'
                    : 'Enter your TaxJar API key'
                }
                onChange={(e) => {
                  const value = e.target.value.trim();
                  if (value) {
                    updateTaxJarSettings.mutate({ taxJarApiKey: value });
                  }
                }}
                disabled={updateTaxJarSettings.isPending}
              />
              <p className='text-muted-foreground text-xs'>
                {taxJarSettings?.hasApiKey
                  ? 'API key is configured. Enter a new key to update it.'
                  : 'Get your API key from https://app.taxjar.com/account#api-access. If not set here, the global TAXJAR_API_KEY environment variable will be used.'}
                <br />
                {taxJarSettings?.isSandbox && (
                  <span className='text-muted-foreground/80 mt-1 flex items-center gap-1'>
                    <span className='rounded bg-yellow-500/20 px-1.5 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400'>
                      SANDBOX MODE
                    </span>
                    Using sandbox API: https://api.sandbox.taxjar.com
                  </span>
                )}
                {!taxJarSettings?.isSandbox && taxJarSettings?.hasApiKey && (
                  <span className='text-muted-foreground/80 mt-1 flex items-center gap-1'>
                    <span className='rounded bg-green-500/20 px-1.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400'>
                      PRODUCTION MODE
                    </span>
                    Using production API: https://api.taxjar.com
                  </span>
                )}
              </p>
            </div>

            {/* Nexus Regions */}
            <div className='space-y-2'>
              <Label>Nexus Regions</Label>
              <p className='text-muted-foreground text-xs'>
                Add locations where you have tax obligations (nexus). TaxJar
                will calculate tax for customers in these regions.
              </p>

              {/* Existing Nexus Regions */}
              {nexusRegions.length > 0 && (
                <div className='space-y-2'>
                  {nexusRegions.map((region, index) => (
                    <div
                      key={index}
                      className='bg-muted/50 flex items-center justify-between rounded-lg border p-3'
                    >
                      <div className='flex items-center gap-2 text-sm'>
                        <span className='font-medium'>
                          {region.country}
                          {region.state && `, ${region.state}`}
                          {region.city && `, ${region.city}`}
                          {region.zip && ` ${region.zip}`}
                        </span>
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => handleRemoveNexusRegion(index)}
                        disabled={updateTaxJarSettings.isPending}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Nexus Region */}
              <div className='space-y-2 rounded-lg border p-4'>
                <Label className='text-sm font-medium'>Add Nexus Region</Label>
                <div className='grid grid-cols-2 gap-2'>
                  <div>
                    <Label htmlFor='nexus-country' className='text-xs'>
                      Country *
                    </Label>
                    <Select
                      value={newNexusRegion.country}
                      onValueChange={(value) =>
                        setNewNexusRegion({ ...newNexusRegion, country: value })
                      }
                    >
                      <SelectTrigger id='nexus-country'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {newNexusRegion.country === 'US' && (
                    <div>
                      <Label htmlFor='nexus-state' className='text-xs'>
                        State
                      </Label>
                      <Input
                        id='nexus-state'
                        placeholder='e.g., CA, NY'
                        value={newNexusRegion.state}
                        onChange={(e) =>
                          setNewNexusRegion({
                            ...newNexusRegion,
                            state: e.target.value.toUpperCase()
                          })
                        }
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor='nexus-city' className='text-xs'>
                      City
                    </Label>
                    <Input
                      id='nexus-city'
                      placeholder='City name'
                      value={newNexusRegion.city}
                      onChange={(e) =>
                        setNewNexusRegion({
                          ...newNexusRegion,
                          city: e.target.value
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor='nexus-zip' className='text-xs'>
                      ZIP/Postal Code
                    </Label>
                    <Input
                      id='nexus-zip'
                      placeholder='ZIP code'
                      value={newNexusRegion.zip}
                      onChange={(e) =>
                        setNewNexusRegion({
                          ...newNexusRegion,
                          zip: e.target.value
                        })
                      }
                    />
                  </div>
                </div>
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={handleAddNexusRegion}
                  disabled={
                    updateTaxJarSettings.isPending || !newNexusRegion.country
                  }
                  className='w-full'
                >
                  Add Nexus Region
                </Button>
              </div>
            </div>

            <Alert>
              <Info className='h-4 w-4' />
              <AlertDescription>
                <strong>How TaxJar Works:</strong>
                <ul className='mt-2 list-disc space-y-1 pl-5'>
                  <li>
                    TaxJar automatically calculates accurate tax rates based on
                    customer shipping address
                  </li>
                  <li>
                    Supports US sales tax (state, county, city, special
                    districts) and international taxes (VAT, GST, etc.)
                  </li>
                  <li>
                    Tax rates are updated automatically as tax laws change
                  </li>
                  <li>
                    Make sure customer addresses include complete address
                    information (street, city, state, ZIP) for best results
                  </li>
                </ul>
              </AlertDescription>
            </Alert>
          </>
        )}
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Stripe Tax?</AlertDialogTitle>
            <AlertDialogDescription>
              Enabling TaxJar will automatically disable Stripe Tax. Tax
              calculations will switch from Stripe Tax to TaxJar. Are you sure
              you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setShowConfirmDialog(false);
                setPendingToggle(null);
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowConfirmDialog(false);
                // Disable Stripe Tax first, then enable TaxJar
                fetch('/api/organizations/stripe-tax', {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ stripeTaxEnabled: false })
                })
                  .then(() => {
                    queryClient.invalidateQueries({
                      queryKey: ['stripe-tax-settings']
                    });
                    if (pendingToggle !== null) {
                      updateTaxJarSettings.mutate({
                        taxJarEnabled: pendingToggle
                      });
                    }
                    setPendingToggle(null);
                  })
                  .catch((error) => {
                    toast.error(
                      'Failed to disable Stripe Tax: ' + error.message
                    );
                    setPendingToggle(null);
                  });
              }}
            >
              Yes, Enable TaxJar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
