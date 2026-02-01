import {
  IconFileText,
  IconChartLine,
  IconUsers,
  type TablerIcon
} from '@tabler/icons-react';

export interface ReportsNavItem {
  title: string;
  href: string;
  icon: TablerIcon;
}

/**
 * Reports navigation configuration
 *
 * This configuration defines the navigation items for the reports page sidebar.
 * Each item represents a reports section that users can navigate to.
 */
export const reportsNavItems: ReportsNavItem[] = [
  {
    title: 'Custom Reports',
    href: '/dashboard/reports',
    icon: IconFileText
  },
  {
    title: 'Financial Forecasting',
    href: '/dashboard/reports/forecasting',
    icon: IconChartLine
  },
  {
    title: 'Customer Lifetime Value',
    href: '/dashboard/reports/clv',
    icon: IconUsers
  }
];
