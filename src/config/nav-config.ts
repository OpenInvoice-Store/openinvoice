import { NavItem } from '@/types';

/**
 * Navigation configuration with RBAC support
 *
 * This configuration is used for both the sidebar navigation and Cmd+K bar.
 *
 * RBAC Access Control:
 * Each navigation item can have an `access` property that controls visibility
 * based on permissions, plans, features, roles, and organization context.
 *
 * Examples:
 *
 * 1. Require organization:
 *    access: { requireOrg: true }
 *
 * 2. Require specific permission:
 *    access: { requireOrg: true, permission: 'org:teams:manage' }
 *
 * 3. Require specific plan:
 *    access: { plan: 'pro' }
 *
 * 4. Require specific feature:
 *    access: { feature: 'premium_access' }
 *
 * 5. Require specific role:
 *    access: { role: 'admin' }
 *
 * 6. Multiple conditions (all must be true):
 *    access: { requireOrg: true, permission: 'org:teams:manage', plan: 'pro' }
 *
 * Note: The `visible` function is deprecated but still supported for backward compatibility.
 * Use the `access` property for new items.
 */
export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: []
  },
  {
    title: 'Invoicing',
    url: '#',
    icon: 'invoices',
    isActive: true,
    items: [
      {
        title: 'Invoices',
        url: '/dashboard/invoices',
        icon: 'invoices',
        shortcut: ['i', 'i']
      },
      {
        title: 'Recurring Invoices',
        url: '/dashboard/recurring-invoices',
        icon: 'invoices',
        shortcut: ['r', 'r']
      },
      {
        title: 'Customers',
        url: '/dashboard/customers',
        icon: 'customers',
        shortcut: ['c', 'c']
      },
      {
        title: 'Products',
        url: '/dashboard/products',
        icon: 'product',
        shortcut: ['p', 'p']
      }
    ]
  },

  {
    title: 'Kanban',
    url: '/dashboard/kanban',
    icon: 'kanban',
    shortcut: ['k', 'k'],
    isActive: false,
    items: []
  },
  {
    title: 'Reports',
    url: '/dashboard/reports',
    icon: 'post',
    shortcut: ['r', 'e'],
    isActive: false,
    items: []
  },

  {
    title: 'Workspaces',
    url: '/dashboard/workspaces',
    icon: 'workspace',
    isActive: false,
    items: []
  },
  {
    title: 'Teams',
    url: '/dashboard/workspaces/team',
    icon: 'teams',
    isActive: false,
    items: [],
    // Require organization to be active
    access: { requireOrg: true }
    // Alternative: require specific permission
    // access: { requireOrg: true, permission: 'org:teams:view' }
  },

  {
    title: 'Account',
    url: '#', // Placeholder as there is no direct link for the parent
    icon: 'account',
    isActive: true,
    items: [
      {
        title: 'Profile',
        url: '/dashboard/profile',
        icon: 'profile',
        shortcut: ['m', 'm']
      },
      {
        title: 'Settings',
        url: '/dashboard/settings',
        icon: 'settings',
        shortcut: ['s', 's'],
        access: { requireOrg: true }
      }
    ]
  }
];
