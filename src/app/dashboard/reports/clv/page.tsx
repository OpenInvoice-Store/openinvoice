'use client';

import PageContainer from '@/components/layout/page-container';
import { CustomerLifetimeValue } from '@/features/invoicing/components/customer-lifetime-value';

export default function CLVPage() {
  return (
    <PageContainer
      pageTitle='Customer Lifetime Value Analysis'
      pageDescription='Analyze customer value based on historical revenue and future projections'
    >
      <CustomerLifetimeValue />
    </PageContainer>
  );
}
