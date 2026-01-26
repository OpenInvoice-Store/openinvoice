import {
  IconNotes,
  IconFileText,
  IconChartBar,
  IconReceipt,
  IconBell,
  type TablerIcon
} from '@tabler/icons-react';

export interface RecurringInvoiceNavItem {
  title: string;
  href: string;
  icon: TablerIcon;
  badgeKey?: string; // Key to access badge count from template data
}

/**
 * Recurring invoice detail navigation configuration
 *
 * This configuration defines the navigation items for the recurring invoice detail page sidebar.
 * Each item represents a section that users can navigate to.
 */
export const recurringInvoiceNavItems: RecurringInvoiceNavItem[] = [
  {
    title: 'Overview',
    href: 'overview',
    icon: IconNotes
  },
  {
    title: 'Items',
    href: 'items',
    icon: IconFileText
  },
  {
    title: 'Usage',
    href: 'usage',
    icon: IconChartBar
  },
  {
    title: 'Invoices',
    href: 'invoices',
    icon: IconReceipt,
    badgeKey: 'invoices.length'
  },
  {
    title: 'Notes',
    href: 'notes',
    icon: IconBell
  }
];
