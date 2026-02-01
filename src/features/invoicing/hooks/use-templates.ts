import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface InvoiceTemplate {
  id: string;
  name: string;
  layout: string | null;
  headerTemplate: string | null;
  footerTemplate: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useInvoiceTemplates() {
  return useQuery<InvoiceTemplate[]>({
    queryKey: ['invoice-templates'],
    queryFn: async () => {
      const res = await fetch('/api/invoice-templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    }
  });
}

export function useCreateInvoiceTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      layout?: string | null;
      headerTemplate?: string | null;
      footerTemplate?: string | null;
      isDefault?: boolean;
    }) => {
      const res = await fetch('/api/invoice-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast.success('Template created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create template');
    }
  });
}

export function useUpdateInvoiceTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      layout?: string | null;
      headerTemplate?: string | null;
      footerTemplate?: string | null;
      isDefault?: boolean;
      isActive?: boolean;
    }) => {
      const res = await fetch(`/api/invoice-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast.success('Template updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update template');
    }
  });
}

export function useDeleteInvoiceTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoice-templates/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast.success('Template deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete template');
    }
  });
}

export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/invoice-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to set default template');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-templates'] });
      toast.success('Default template updated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to set default template');
    }
  });
}
