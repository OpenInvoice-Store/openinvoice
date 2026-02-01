import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface Installment {
  id: string;
  paymentPlanId: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  paidAt?: string | null;
  totalPaid?: number;
  remaining?: number;
  payments?: Array<{
    id: string;
    amount: number;
    date: string;
    method: string;
  }>;
}

export interface PaymentPlan {
  id: string;
  invoiceId: string;
  totalAmount: number;
  installmentCount: number;
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'custom';
  startDate: string;
  status: 'active' | 'completed' | 'cancelled';
  installments: Installment[];
}

export function usePaymentPlan(invoiceId: string) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<PaymentPlan | null>({
    queryKey: ['paymentPlan', invoiceId],
    queryFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}/payment-plan`);
      if (!response.ok) {
        if (response.status === 404) {
          return null; // No payment plan exists
        }
        throw new Error('Failed to fetch payment plan');
      }
      return response.json();
    },
    enabled: !!invoiceId
  });

  const createPaymentPlan = useMutation({
    mutationFn: async (data: {
      installmentCount: number;
      frequency: string;
      startDate: string;
    }) => {
      const response = await fetch(`/api/invoices/${invoiceId}/payment-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create payment plan');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentPlan', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      toast.success('Payment plan created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create payment plan');
    }
  });

  const deletePaymentPlan = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/invoices/${invoiceId}/payment-plan`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete payment plan');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['paymentPlan', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      toast.success('Payment plan deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete payment plan');
    }
  });

  return {
    paymentPlan: data,
    isLoading,
    error,
    createPaymentPlan,
    deletePaymentPlan
  };
}
