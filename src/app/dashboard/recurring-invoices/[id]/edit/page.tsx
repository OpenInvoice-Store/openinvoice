import PageContainer from '@/components/layout/page-container';
import { RecurringInvoiceForm } from '@/features/invoicing/components/recurring-invoice-form';

export const metadata = {
  title: 'Dashboard: Edit Recurring Invoice'
};

export default function EditRecurringInvoicePage() {
  return (
    <PageContainer
      pageTitle='Edit Recurring Invoice Template'
      pageDescription='Update recurring invoice template settings'
    >
      <RecurringInvoiceForm />
    </PageContainer>
  );
}
