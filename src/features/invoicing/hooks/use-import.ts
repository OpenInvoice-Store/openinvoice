import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ImportResult {
  success: boolean;
  message: string;
  count?: number;
  errors?: Array<{
    row: number;
    field: string;
    message: string;
  }>;
  validCount?: number;
  errorCount?: number;
}

export function useImportProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import/products', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        // If it's a validation error (400), return the data so UI can display errors
        if (res.status === 400 && data.errors) {
          return data;
        }
        // For other errors, throw
        throw new Error(data.error || 'Failed to import products');
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['products'] });
        toast.success(
          data.message || `Successfully imported ${data.count} product(s)`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to import products');
    }
  });
}

export function useImportCustomers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File): Promise<ImportResult> => {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/import/customers', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        // If it's a validation error (400), return the data so UI can display errors
        if (res.status === 400 && data.errors) {
          return data;
        }
        // For other errors, throw
        throw new Error(data.error || 'Failed to import customers');
      }

      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        toast.success(
          data.message || `Successfully imported ${data.count} customer(s)`
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to import customers');
    }
  });
}

export function useDownloadTemplate() {
  return useMutation({
    mutationFn: async (type: 'products' | 'customers'): Promise<void> => {
      const res = await fetch(`/api/import/template/${type}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to download template');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-import-template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    },
    onSuccess: () => {
      toast.success('Template downloaded successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to download template');
    }
  });
}
