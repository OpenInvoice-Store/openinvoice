import PageContainer from '@/components/layout/page-container';
import { InvoiceForm } from '@/features/invoicing/components/invoice-form';

export const metadata = {
  title: 'Dashboard: New Invoice'
};

export default function NewInvoicePage() {
  return (
    <PageContainer
      pageTitle='New Invoice'
      pageDescription='Create a new invoice'
    >
      <InvoiceForm />
    </PageContainer>
  );
}

