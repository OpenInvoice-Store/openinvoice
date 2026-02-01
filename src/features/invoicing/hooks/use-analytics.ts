import { useQuery } from '@tanstack/react-query';

export interface ForecastData {
  month: string;
  monthKey: string;
  projectedRevenue: number;
  recurringRevenue: number;
  trendRevenue: number;
  confidence: number;
}

export interface ForecastSummary {
  totalProjected: number;
  avgMonthlyProjected: number;
  avgConfidence: number;
  activeRecurringTemplates: number;
  historicalAvgMonthly: number;
  trend: number;
}

export interface CLVMetrics {
  totalRevenue: number;
  paidRevenue: number;
  avgOrderValue: number;
  purchaseFrequency: number;
  customerAge: number;
  customerAgeYears: number;
  totalInvoices: number;
  paidInvoices: number;
  activeRecurringTemplates: number;
}

export interface CLVData {
  historical: number;
  projectedFuture: number;
  total: number;
  predicted12Months: number;
}

export interface CustomerCLV {
  customerId: string;
  customerName: string;
  customerEmail: string | null;
  metrics: CLVMetrics;
  clv: CLVData;
  valueScore: number;
  segment: string;
}

export interface CLVSummary {
  totalCustomers: number;
  totalCLV: number;
  avgCLV: number;
  highValueCount: number;
  mediumValueCount: number;
  lowValueCount: number;
}

export function useFinancialForecast(period: string) {
  return useQuery<{
    forecasts: ForecastData[];
    summary: ForecastSummary;
  }>({
    queryKey: ['forecast', period],
    queryFn: async () => {
      const response = await fetch(
        `/api/analytics/forecasting?period=${period}`
      );
      if (!response.ok) {
        throw new Error('Failed to fetch forecast');
      }
      return response.json();
    }
  });
}

export function useCustomerLifetimeValue() {
  return useQuery<{
    customers: CustomerCLV[];
    summary: CLVSummary;
  }>({
    queryKey: ['clv'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/clv');
      if (!response.ok) {
        throw new Error('Failed to fetch CLV data');
      }
      return response.json();
    }
  });
}
