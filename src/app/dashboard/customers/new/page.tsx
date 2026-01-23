import PageContainer from '@/components/layout/page-container';
import { CustomerForm } from '@/features/invoicing/components/customer-form';

export const metadata = {
  title: 'Dashboard: New Customer'
};

export default function NewCustomerPage() {
  return (
    <PageContainer
      pageTitle='New Customer'
      pageDescription='Add a new customer to your system'
    >
      <CustomerForm />
    </PageContainer>
  );
}

