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
  changes_required: 'expiring',
  suspended: 'expired',
  deleted: 'expired',
  failed: 'expired',
  rejected: 'expired',
  resolved: 'neutral',
  dismissed: 'neutral',
  merged_into: 'neutral',
};

const DOT_COLORS: Record<string, string> = {
  good: 'bg-emerald-500',
  expiring: 'bg-amber-500',
  expired: 'bg-red-500',
  neutral: 'bg-neutral-400',
};

export function StatusBadge({ status }: { status: string }) {
  const variant = VARIANTS[status] ?? 'neutral';
  const isExpiring = variant === 'expiring';

  return (
    <Badge variant={variant} className="gap-1.5 capitalize">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_COLORS[variant]} ${
          isExpiring ? 'animate-pulse' : ''
        }`}
      />
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}
