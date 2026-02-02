import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Payment } from './use-payments';

export interface Invoice {
  id: string;
  invoiceNo: string;
  status: string;
  issueDate: string;
  dueDate: string;
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    price: number;
    taxRate: number;
  }>;
  payments: Payment[];
}

export interface Customer {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  createdAt: string;
  updatedAt: string;
  invoices?: Invoice[];
}

export function useCustomers(search?: string) {
  return useQuery<Customer[]>({
    queryKey: ['customers', search],
    queryFn: async () => {
      const url = search
        ? `/api/customers?search=${encodeURIComponent(search)}`
        : '/api/customers';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch customers');
      return res.json();
    }
  });
}

export function useCustomer(id: string) {
  return useQuery<Customer>({
    queryKey: ['customer', id],
    queryFn: async () => {
      const res = await fetch(`/api/customers/${id}`);
      if (!res.ok) throw new Error('Failed to fetch customer');
      return res.json();
    },
    enabled: !!id
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>
    ) => {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create customer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Customer> & { id: string }) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update customer');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer', variables.id] });
    }
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage =
          errorData.details || errorData.error || 'Failed to delete customer';
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    }
  });
}

export function useCustomerPayments(customerId: string) {
  return useQuery<Payment[]>({
    queryKey: ['customer-payments', customerId],
    queryFn: async () => {
      const res = await fetch(`/api/payments?customerId=${customerId}`);
      if (!res.ok) throw new Error('Failed to fetch customer payments');
      return res.json();
    },
    enabled: !!customerId
  });
}
