import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  productId: string;
  description: string;
  quantity: number;
  price: number;
  taxRate: number;
  product?: {
    id: string;
    name: string;
    price: number;
  };
}

export interface Invoice {
  id: string;
  invoiceNo: number;
  customerId: string;
  status: string;
  issueDate: string;
  dueDate: string;
  notes?: string | null;
  shareToken?: string | null;
  emailSentCount?: number;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    email?: string | null;
  };
  items: InvoiceItem[];
  payments: Payment[];
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: string;
  notes?: string | null;
  createdAt: string;
}

export function useInvoices(status?: string, customerId?: string) {
  return useQuery<Invoice[]>({
    queryKey: ['invoices', status, customerId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);
      if (customerId) params.append('customerId', customerId);
      const url = `/api/invoices${params.toString() ? `?${params.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json();
    }
  });
}

export function useInvoice(id: string) {
  return useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error('Failed to fetch invoice');
      return res.json();
    },
    enabled: !!id
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      customerId: string;
      dueDate: string;
      issueDate?: string;
      status?: string;
      notes?: string;
      items: Array<{
        productId: string;
        description: string;
        quantity: number;
        price: number;
        taxRate?: number;
      }>;
    }) => {
      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create invoice');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: Partial<Invoice> & {
      id: string;
      items?: Array<{
        productId: string;
        description: string;
        quantity: number;
        price: number;
        taxRate?: number;
      }>;
    }) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update invoice');
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoice', variables.id] });
    }
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoices/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Failed to delete invoice');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
}
