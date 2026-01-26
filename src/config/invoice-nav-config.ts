import {
  IconNotes,
  IconCurrencyDollar,
  IconMail,
  IconBell,
  type TablerIcon
} from '@tabler/icons-react';

export interface InvoiceNavItem {
  title: string;
  href: string;
  icon: TablerIcon;
  badgeKey?: string; // Key to access badge count from invoice data
}

/**
 * Invoice detail navigation configuration
 *
 * This configuration defines the navigation items for the invoice detail page sidebar.
 * Each item represents a section that users can navigate to.
 */
export const invoiceNavItems: InvoiceNavItem[] = [
  {
    title: 'Details',
    href: 'details',
    icon: IconNotes
  },
  {
    title: 'Payments',
    href: 'payments',
    icon: IconCurrencyDollar,
    badgeKey: 'payments.length'
  },
  {
    title: 'Emails',
    href: 'emails',
    icon: IconMail,
    badgeKey: 'emailLogs.length'
  },
  {
    title: 'Reminders',
    href: 'reminders',
    icon: IconBell,
    badgeKey: 'reminderCount'
  },
  {
    title: 'Notes',
    href: 'notes',
    icon: IconNotes
  }
];
