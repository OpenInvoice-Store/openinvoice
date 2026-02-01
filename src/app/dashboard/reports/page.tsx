'use client';

import PageContainer from '@/components/layout/page-container';
import { ReportBuilder } from '@/features/invoicing/components/report-builder';

export default function ReportsPage() {
  return (
    <PageContainer
      pageTitle='Custom Reports'
      pageDescription='Build custom reports with filters and data selections'
    >
      <ReportBuilder />
    </PageContainer>
  );
}
