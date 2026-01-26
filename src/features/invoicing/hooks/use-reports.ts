import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface ReportParams {
  reportType: 'invoices' | 'payments' | 'customers' | 'products' | 'revenue';
  startDate?: string;
  endDate?: string;
  status?: string;
  customerId?: string;
  groupBy?: 'none' | 'customer' | 'status' | 'month' | 'product';
  includeItems?: boolean;
  includePayments?: boolean;
}

export interface ReportData {
  results: any[];
  summary: any;
  grouped?: boolean;
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: async (params: ReportParams): Promise<ReportData> => {
      const searchParams = new URLSearchParams({
        reportType: params.reportType,
        includeItems: String(params.includeItems ?? false),
        includePayments: String(params.includePayments ?? false),
        ...(params.startDate && { startDate: params.startDate }),
        ...(params.endDate && { endDate: params.endDate }),
        ...(params.status && { status: params.status }),
        ...(params.customerId && { customerId: params.customerId }),
        ...(params.groupBy && { groupBy: params.groupBy })
      });

      const res = await fetch(`/api/reports?${searchParams.toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to generate report');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Report generated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate report');
    }
  });
}

export function useExportReport() {
  return useMutation({
    mutationFn: async ({
      params,
      format
    }: {
      params: ReportParams;
      format: 'csv' | 'xlsx';
    }): Promise<Blob> => {
      const searchParams = new URLSearchParams({
        reportType: params.reportType,
        format,
        includeItems: String(params.includeItems ?? false),
        includePayments: String(params.includePayments ?? false),
        ...(params.startDate && { startDate: params.startDate }),
        ...(params.endDate && { endDate: params.endDate }),
        ...(params.status && { status: params.status }),
        ...(params.customerId && { customerId: params.customerId }),
        ...(params.groupBy && { groupBy: params.groupBy })
      });

      const res = await fetch(`/api/reports/export?${searchParams.toString()}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to export report');
      }
      return res.blob();
    },
    onSuccess: () => {
      toast.success('Report exported successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to export report');
    }
  });
}
