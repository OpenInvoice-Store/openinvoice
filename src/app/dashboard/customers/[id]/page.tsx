import PageContainer from '@/components/layout/page-container';
import { CustomerView } from '@/features/invoicing/components/customer-view';

export const metadata = {
  title: 'Dashboard: Customer Details'
};

export default function CustomerDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageContainer
      pageTitle='Customer Details'
      pageDescription='View customer details and payment history'
    >
      <CustomerView />
    </PageContainer>
  );
}
