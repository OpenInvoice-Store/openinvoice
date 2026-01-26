import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface StripeConnectStatus {
  connected: boolean;
  accountId?: string;
  status?: string;
  email?: string;
  detailsSubmitted?: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  connectEnabled?: boolean;
}

export function useStripeConnectStatus(enabled: boolean = true) {
  return useQuery<StripeConnectStatus>({
    queryKey: ['stripe-connect-status'],
    queryFn: async () => {
      const response = await fetch('/api/stripe/connect/status');
      if (!response.ok) {
        throw new Error('Failed to fetch Stripe status');
      }
      return response.json();
    },
    enabled,
    refetchInterval: 5000 // Poll every 5 seconds when connecting
  });
}

export function useConnectStripe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ url?: string }> => {
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
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to connect Stripe account');
    }
  });
}

export function useDisconnectStripe() {
  const queryClient = useQueryClient();
  return useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
      toast.success(
        'Stripe payments have been disconnected for this organization (Stripe account remains active).'
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to disconnect Stripe account');
    }
  });
}

export function useEnableStripePayments() {
  const queryClient = useQueryClient();
  return useMutation({
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
      queryClient.invalidateQueries({ queryKey: ['stripe-connect-status'] });
      toast.success('Stripe payments enabled successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to enable Stripe payments');
    }
  });
}
