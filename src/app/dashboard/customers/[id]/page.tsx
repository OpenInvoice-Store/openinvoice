import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Dashboard: Customer Details'
};

export default async function CustomerDetailsPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/dashboard/customers/${id}/details`);
}
