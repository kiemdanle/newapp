import { Badge } from '@/components/ui/badge';

const VARIANTS: Record<string, 'good' | 'expiring' | 'expired' | 'neutral'> = {
  active: 'good',
  visible: 'good',
  sent: 'good',
  approved: 'good',
  closed: 'good',
  pending: 'expiring',
  hidden: 'neutral',
  open: 'expiring',
  halfOpen: 'expiring',
  suspended: 'expired',
  deleted: 'expired',
  failed: 'expired',
  rejected: 'expired',
  resolved: 'neutral',
  dismissed: 'neutral',
  merged_into: 'neutral',
};

const DOT_COLORS: Record<string, string> = {
  good: 'bg-primary',
  expiring: 'bg-accent',
  expired: 'bg-expired',
  neutral: 'bg-neutral-mid',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = VARIANTS[status] ?? 'neutral';
  return (
    <Badge variant={variant} className="gap-1.5">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_COLORS[variant]}`} />
      {status}
    </Badge>
  );
}
