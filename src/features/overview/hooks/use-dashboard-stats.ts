import { useQuery } from '@tanstack/react-query';

export interface DashboardStats {
  totalRevenue?: number;
  invoiceCounts: Record<string, number>;
  revenueByDay: Record<string, number>;
  invoicesByMonth: Record<string, number>;
  recentInvoices: Array<{
    id: string;
    invoiceNo: number;
    customerName: string;
    total: number;
    status: string;
    issueDate: string;
  }>;
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch dashboard stats');
      return res.json();
    },
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  });
}

// Specific hooks for individual charts
export function useInvoiceStatusCounts() {
  const { data, ...rest } = useDashboardStats();
  return {
    data: data?.invoiceCounts ?? {},
    ...rest
  };
}

export function useRevenueByDay() {
  const { data, ...rest } = useDashboardStats();
  return {
    data: data?.revenueByDay ?? {},
    ...rest
  };
}

export function useInvoicesByMonth() {
  const { data, ...rest } = useDashboardStats();
  return {
    data: data?.invoicesByMonth ?? {},
    ...rest
  };
}

export function useRecentInvoices() {
  const { data, ...rest } = useDashboardStats();
  return {
    data: data?.recentInvoices ?? [],
    ...rest
  };
}
