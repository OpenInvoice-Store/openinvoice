import {
  IconNotes,
  IconCurrencyDollar,
  IconCreditCard,
  type TablerIcon
} from '@tabler/icons-react';

export interface CustomerNavItem {
  title: string;
  href: string;
  icon: TablerIcon;
  badgeKey?: string; // Key to access badge count from customer data
}

/**
 * Customer detail navigation configuration
 *
 * This configuration defines the navigation items for the customer detail page sidebar.
 * Each item represents a section that users can navigate to.
 */
export const customerNavItems: CustomerNavItem[] = [
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
    title: 'Payment Methods',
    href: 'payment-methods',
    icon: IconCreditCard
  }
];
