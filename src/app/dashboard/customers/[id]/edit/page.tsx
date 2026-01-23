import PageContainer from '@/components/layout/page-container';
import { CustomerForm } from '@/features/invoicing/components/customer-form';

export const metadata = {
  title: 'Dashboard: Edit Customer'
};

export default function EditCustomerPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageContainer
      pageTitle='Edit Customer'
      pageDescription='Update customer information'
    >
      <CustomerForm />
    </PageContainer>
  );
}

