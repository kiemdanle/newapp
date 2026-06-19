// apps/admin/src/lib/nav.ts
export interface NavItem {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', href: '/' }],
  },
  {
    title: 'Moderation',
    items: [
      { label: 'Reports', href: '/reports' },
      { label: 'Reviews', href: '/reviews' },
      { label: 'Deals', href: '/deals' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Products', href: '/products' },
      { label: 'Pending edits', href: '/products/pending' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Users', href: '/users' },
      { label: 'Referrals', href: '/referrals' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Overview', href: '/analytics/overview' },
      { label: 'Scans', href: '/analytics/scans' },
      { label: 'Reviews', href: '/analytics/reviews' },
      { label: 'Geography', href: '/analytics/geography' },
    ],
  },
  {
    title: 'Households',
    items: [{ label: 'Households', href: '/households' }],
  },
  {
    title: 'System',
    items: [
      { label: 'Queue', href: '/system/queue' },
      { label: 'Push logs', href: '/system/push' },
      { label: 'API errors', href: '/system/api-errors' },
      { label: 'External APIs', href: '/system/external-apis' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Feature flags', href: '/settings/feature-flags' },
      { label: 'Notification templates', href: '/settings/notification-templates' },
      { label: 'Moderation', href: '/settings/moderation' },
      { label: 'Admins', href: '/settings/admins' },
    ],
  },
];
