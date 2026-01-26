import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface EmailLog {
  id: string;
  invoiceId: string;
  recipientEmail: string;
  subject: string;
  sentAt: string;
  status: string;
  errorMessage?: string | null;
}

export function useInvoiceEmailLogs(invoiceId: string) {
  return useQuery<EmailLog[]>({
    queryKey: ['emailLogs', invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${invoiceId}/email-logs`);
      if (!res.ok) throw new Error('Failed to fetch email logs');
      return res.json();
    },
    enabled: !!invoiceId
  });
}

export function useGenerateShareLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string): Promise<{ shareUrl: string }> => {
      const response = await fetch(`/api/invoices/${invoiceId}/share`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to generate share link');
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.shareUrl);
      return data;
    },
    onSuccess: () => {
      toast.success('Shareable link copied to clipboard!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate share link');
    }
  });
}

export function useSendInvoiceEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}/send-email`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send email');
      }

      return response.json();
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['emailLogs', invoiceId] });
      toast.success('Invoice email sent successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send email');
    }
  });
}

export function useSendInvoiceReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const response = await fetch(`/api/invoices/${invoiceId}/send-reminder`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send reminder');
      }

      return response.json();
    },
    onSuccess: (_, invoiceId) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['emailLogs', invoiceId] });
      toast.success('Payment reminder sent successfully!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send reminder');
    }
  });
}
