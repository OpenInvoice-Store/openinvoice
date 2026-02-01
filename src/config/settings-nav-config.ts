import {
  CreditCard,
  Palette,
  Settings,
  FileText,
  Mail,
  MessageSquare,
  LucideIcon
} from 'lucide-react';

export interface SettingsNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Settings navigation configuration
 *
 * This configuration defines the navigation items for the settings page sidebar.
 * Each item represents a settings section that users can navigate to.
 */
export const settingsNavItems: SettingsNavItem[] = [
  {
    title: 'Payment Processing',
    href: '/dashboard/settings/payments',
    icon: CreditCard
  },
  {
    title: 'Branding',
    href: '/dashboard/settings/branding',
    icon: Palette
  },
  {
    title: 'Templates',
    href: '/dashboard/settings/templates',
    icon: FileText
  },
  {
    title: 'Notifications',
    href: '/dashboard/settings/notifications',
    icon: Mail
  }
];
