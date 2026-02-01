'use client';

import PageContainer from '@/components/layout/page-container';
import { FinancialForecasting } from '@/features/invoicing/components/financial-forecasting';

export default function ForecastingPage() {
  return (
    <PageContainer
      pageTitle='Financial Forecasting'
      pageDescription='Projected revenue based on historical trends and recurring invoices'
    >
      <FinancialForecasting />
    </PageContainer>
  );
}
