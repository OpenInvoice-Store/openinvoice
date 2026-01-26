import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Invoice Details'
};

export default async function InvoiceDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/invoices/${id}/details`);
}
