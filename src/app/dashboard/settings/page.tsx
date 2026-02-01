import { redirect } from 'next/navigation';

export default function SettingsPage() {
  // Redirect to payments page by default
  redirect('/dashboard/settings/payments');
}
