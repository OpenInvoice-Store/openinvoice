import PageContainer from '@/components/layout/page-container';
import { InvoiceView } from '@/features/invoicing/components/invoice-view';

export const metadata = {
  title: 'Dashboard: Invoice Details'
};

export default function InvoiceDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageContainer
      pageTitle='Invoice Details'
      pageDescription='View invoice details and manage payments'
    >
      <InvoiceView />
    </PageContainer>
  );
}

