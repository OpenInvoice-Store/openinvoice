'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IconCreditCard, IconCheck, IconRefresh } from '@tabler/icons-react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface PaymentMethod {
  id: string;
  type: string;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  } | null;
  billingDetails: any;
}

interface PaymentMethodsResponse {
  paymentMethods: PaymentMethod[];
  preferredPaymentMethodId: string | null;
}

interface CustomerPaymentMethodsProps {
  customerId: string;
}

export function CustomerPaymentMethods({
  customerId
}: CustomerPaymentMethodsProps) {
  const queryClient = useQueryClient();
  const [isSettingPreferred, setIsSettingPreferred] = useState<string | null>(
    null
  );

  const { data, isLoading, refetch } = useQuery<PaymentMethodsResponse>({
    queryKey: ['customer-payment-methods', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${customerId}/payment-methods`);
      if (!res.ok) throw new Error('Failed to fetch payment methods');
      return res.json();
    }
  });

  const setPreferredMutation = useMutation({
    mutationFn: async (paymentMethodId: string | null) => {
      const res = await fetch(`/api/customers/${customerId}/payment-methods`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferredPaymentMethodId: paymentMethodId })
      });
      if (!res.ok) throw new Error('Failed to update preference');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['customer-payment-methods', customerId]
      });
      toast.success('Preferred payment method updated');
      setIsSettingPreferred(null);
    },
    onError: () => {
      toast.error('Failed to update preferred payment method');
      setIsSettingPreferred(null);
    }
  });

  const handleSetPreferred = (paymentMethodId: string | null) => {
    setIsSettingPreferred(paymentMethodId);
    setPreferredMutation.mutate(paymentMethodId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <div className='flex items-center justify-center p-4'>
            <Loader2 className='h-5 w-5 animate-spin' />
            <span className='text-muted-foreground ml-2 text-sm'>
              Loading...
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const paymentMethods = data?.paymentMethods || [];
  const preferredPaymentMethodId = data?.preferredPaymentMethodId || null;

  return (
    <Card>
      <CardHeader>
        <div className='flex items-center justify-between'>
          <div>
            <CardTitle>Payment Methods</CardTitle>
            <CardDescription>
              Manage saved payment methods and set default preferences
            </CardDescription>
          </div>
          <Button variant='outline' size='sm' onClick={() => refetch()}>
            <IconRefresh className='mr-2 h-4 w-4' />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className='space-y-4'>
        {paymentMethods.length === 0 ? (
          <div className='text-muted-foreground py-8 text-center'>
            <IconCreditCard className='mx-auto mb-4 h-12 w-12 opacity-50' />
            <p className='text-sm'>No saved payment methods</p>
            <p className='mt-1 text-xs'>
              Payment methods will appear here after the customer makes their
              first payment
            </p>
          </div>
        ) : (
          <div className='space-y-3'>
            {paymentMethods.map((pm) => {
              const isPreferred = pm.id === preferredPaymentMethodId;
              const isSetting = isSettingPreferred === pm.id;

              return (
                <div
                  key={pm.id}
                  className='flex items-center justify-between rounded-lg border p-4'
                >
                  <div className='flex items-center gap-3'>
                    <div className='bg-muted rounded p-2'>
                      <IconCreditCard className='h-5 w-5' />
                    </div>
                    <div>
                      {pm.card && (
                        <div className='flex items-center gap-2'>
                          <span className='font-medium capitalize'>
                            {pm.card.brand} •••• {pm.card.last4}
                          </span>
                          <Badge variant='outline' className='text-xs'>
                            Expires {pm.card.expMonth}/{pm.card.expYear}
                          </Badge>
                        </div>
                      )}
                      {pm.billingDetails?.name && (
                        <p className='text-muted-foreground text-sm'>
                          {pm.billingDetails.name}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className='flex items-center gap-2'>
                    {isPreferred && (
                      <Badge variant='default' className='bg-green-600'>
                        <IconCheck className='mr-1 h-3 w-3' />
                        Default
                      </Badge>
                    )}
                    <Button
                      variant={isPreferred ? 'outline' : 'default'}
                      size='sm'
                      onClick={() =>
                        handleSetPreferred(isPreferred ? null : pm.id)
                      }
                      disabled={isSetting}
                    >
                      {isSetting ? (
                        <>
                          <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                          Setting...
                        </>
                      ) : isPreferred ? (
                        'Remove Default'
                      ) : (
                        'Set as Default'
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
