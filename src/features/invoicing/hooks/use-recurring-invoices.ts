import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface RecurringInvoiceTemplate {
  id: string;
  name: string;
  organizationId: string;
  customerId: string;
  frequency:
    | 'daily'
    | 'weekly'
    | 'biweekly'
    | 'monthly'
    | 'quarterly'
    | 'yearly'
    | 'custom';
  interval: number;
  startDate: string;
  endDate: string | null;
  nextGenerationDate: string;
  templateItems: string; // JSON string
  templateNotes: string | null;
  daysUntilDue: number;
  status: 'active' | 'paused' | 'cancelled' | 'completed';
  autoSendEmail: boolean;
  totalGenerated: number;
  lastGeneratedAt: string | null;
  isUsageBased: boolean;
  usageUnit: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    email: string | null;
  };
  organization?: {
    id: string;
    name: string;
  };
  invoices?: Array<{
    id: string;
    invoiceNo: number;
    status: string;
    issueDate: string;
    dueDate: string;
    createdAt: string;
  }>;
  _count?: {
    invoices: number;
  };
}

export interface UsageRecord {
  id: string;
  recurringTemplateId: string;
  invoiceId: string | null;
  periodStart: string;
  periodEnd: string;
  quantity: number;
  metadata: string | null;
  recordedAt: string;
  recordedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringInvoiceTemplateItem {
  productId: string;
  description: string;
  quantity: number;
  price: number;
  taxRate: number;
}

export function useRecurringInvoices(status?: string, customerId?: string) {
  const queryParams = new URLSearchParams();
  if (status) queryParams.append('status', status);
  if (customerId) queryParams.append('customerId', customerId);

  return useQuery<RecurringInvoiceTemplate[]>({
    queryKey: ['recurring-invoices', status, customerId],
    queryFn: async () => {
      const url = `/api/recurring-invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch recurring invoices');
      return res.json();
    }
  });
}

export function useRecurringInvoice(id: string) {
  return useQuery<RecurringInvoiceTemplate>({
    queryKey: ['recurring-invoice', id],
    queryFn: async () => {
      const res = await fetch(`/api/recurring-invoices/${id}`);
      if (!res.ok) throw new Error('Failed to fetch recurring invoice');
      return res.json();
    },
    enabled: !!id
  });
}

export function useCreateRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      customerId: string;
      frequency: string;
      interval?: number;
      startDate: string;
      endDate?: string | null;
      templateItems: RecurringInvoiceTemplateItem[];
      templateNotes?: string;
      daysUntilDue?: number;
      autoSendEmail?: boolean;
    }) => {
      const res = await fetch('/api/recurring-invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          templateItems: JSON.stringify(data.templateItems)
        })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create recurring invoice');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
    }
  });
}

export function useUpdateRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      frequency?: string;
      interval?: number;
      startDate?: string;
      endDate?: string | null;
      templateItems?: RecurringInvoiceTemplateItem[];
      templateNotes?: string;
      daysUntilDue?: number;
      status?: string;
      autoSendEmail?: boolean;
    }) => {
      const body: any = { ...data };
      if (data.templateItems) {
        body.templateItems = JSON.stringify(data.templateItems);
      }

      const res = await fetch(`/api/recurring-invoices/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update recurring invoice');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      queryClient.invalidateQueries({
        queryKey: ['recurring-invoice', variables.id]
      });
    }
  });
}

export function useDeleteRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-invoices/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete recurring invoice');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
    }
  });
}

export function useGenerateRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/recurring-invoices/${id}/generate`, {
        method: 'POST'
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate invoice');
      }
      return res.json();
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });
}

export function useUsageRecords(
  templateId: string,
  periodStart?: string,
  periodEnd?: string
) {
  const queryParams = new URLSearchParams();
  if (periodStart) queryParams.append('periodStart', periodStart);
  if (periodEnd) queryParams.append('periodEnd', periodEnd);

  return useQuery<UsageRecord[]>({
    queryKey: ['usage-records', templateId, periodStart, periodEnd],
    queryFn: async () => {
      const url = `/api/recurring-invoices/${templateId}/usage${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch usage records');
      return res.json();
    },
    enabled: !!templateId
  });
}

export function useCreateUsageRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      recurringTemplateId: string;
      periodStart: string;
      periodEnd: string;
      quantity: number;
      metadata?: string;
    }) => {
      const res = await fetch(
        `/api/recurring-invoices/${data.recurringTemplateId}/usage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            quantity: data.quantity,
            metadata: data.metadata
          })
        }
      );
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create usage record');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['usage-records', variables.recurringTemplateId]
      });
      queryClient.invalidateQueries({
        queryKey: ['recurring-invoice', variables.recurringTemplateId]
      });
    }
  });
}
