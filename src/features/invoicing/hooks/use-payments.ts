import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: string;
  notes?: string | null;
  createdAt: string;
  // Stripe payment fields
  stripePaymentIntentId?: string | null;
  stripeChargeId?: string | null;
  stripeCustomerId?: string | null;
  stripeStatus?: string | null;
  // Payment retry fields
  retryCount?: number;
  lastRetryAt?: string | null;
  nextRetryAt?: string | null;
  retryStatus?: string | null;
  maxRetries?: number;
  invoice?: {
    id: string;
    invoiceNo: number;
    currency?: string | null;
    customer?: {
      name: string;
    };
    organization?: {
      defaultCurrency: string;
    };
  };
}

export function usePayments(invoiceId?: string) {
  return useQuery<Payment[]>({
    queryKey: ['payments', invoiceId],
    queryFn: async () => {
      const url = invoiceId
        ? `/api/payments?invoiceId=${invoiceId}`
        : '/api/payments';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch payments');
      return res.json();
    }
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      invoiceId: string;
      amount: number;
      date?: string;
      method: string;
      notes?: string;
    }) => {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create payment');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({
        queryKey: ['invoice', variables.invoiceId]
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payments/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete payment');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
}
