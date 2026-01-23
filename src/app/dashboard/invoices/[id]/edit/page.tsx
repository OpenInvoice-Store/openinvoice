import PageContainer from '@/components/layout/page-container';
import { InvoiceForm } from '@/features/invoicing/components/invoice-form';

export const metadata = {
  title: 'Dashboard: Edit Invoice'
};

export default function EditInvoicePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageContainer
      pageTitle='Edit Invoice'
      pageDescription='Update invoice information'
    >
      <InvoiceForm />
    </PageContainer>
  );
}

