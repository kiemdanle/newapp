// apps/admin/src/lib/nav.ts
export interface NavItem {
  label: string;
  href: string;
  icon: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [{ label: 'Dashboard', href: '/', icon: 'LayoutDashboard' }],
  },
  {
    title: 'Moderation',
    items: [
      { label: 'Reports', href: '/reports', icon: 'Flag' },
      { label: 'Reviews', href: '/reviews', icon: 'MessageSquare' },
      { label: 'Deals', href: '/deals', icon: 'Tags' },
    ],
  },
  {
    title: 'Catalog',
    items: [
      { label: 'Products', href: '/products', icon: 'Package' },
      { label: 'Pending edits', href: '/products/pending', icon: 'Clock' },
    ],
  },
  {
    title: 'People',
    items: [
      { label: 'Users', href: '/users', icon: 'Users' },
      { label: 'Referrals', href: '/referrals', icon: 'Share2' },
    ],
  },
  {
    title: 'Analytics',
    items: [
      { label: 'Overview', href: '/analytics/overview', icon: 'BarChart3' },
      { label: 'Scans', href: '/analytics/scans', icon: 'Smartphone' },
      { label: 'Reviews', href: '/analytics/reviews', icon: 'MessageSquare' },
      { label: 'Geography', href: '/analytics/geography', icon: 'Map' },
    ],
  },
  {
    title: 'Households',
    items: [{ label: 'Households', href: '/households', icon: 'Home' }],
  },
  {
    title: 'System',
    items: [
      { label: 'Queue', href: '/system/queue', icon: 'Server' },
      { label: 'Push logs', href: '/system/push', icon: 'Smartphone' },
      { label: 'API errors', href: '/system/api-errors', icon: 'AlertTriangle' },
      { label: 'External APIs', href: '/system/external-apis', icon: 'Webhook' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Feature flags', href: '/settings/feature-flags', icon: 'ToggleRight' },
      { label: 'Notification templates', href: '/settings/notification-templates', icon: 'Bell' },
      { label: 'Moderation', href: '/settings/moderation', icon: 'Shield' },
      { label: 'Admins', href: '/settings/admins', icon: 'ShieldCheck' },
    ],
  },
];
