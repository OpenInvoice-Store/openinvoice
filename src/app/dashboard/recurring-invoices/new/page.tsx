import PageContainer from '@/components/layout/page-container';
import { RecurringInvoiceForm } from '@/features/invoicing/components/recurring-invoice-form';

export const metadata = {
  title: 'Dashboard: New Recurring Invoice'
};

export default function NewRecurringInvoicePage() {
  return (
    <PageContainer
      pageTitle='New Recurring Invoice Template'
      pageDescription='Create a new recurring invoice template'
    >
      <RecurringInvoiceForm />
    </PageContainer>
  );
}
