import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Recurring Invoice Details'
};

export default async function RecurringInvoiceDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/recurring-invoices/${id}/overview`);
}
