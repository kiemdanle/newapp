import { Badge } from '@/components/ui/badge';

const VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  visible: 'default',
  sent: 'default',
  approved: 'default',
  closed: 'default',
  pending: 'secondary',
  hidden: 'secondary',
  open: 'secondary',
  halfOpen: 'secondary',
  suspended: 'destructive',
  deleted: 'destructive',
  failed: 'destructive',
  rejected: 'destructive',
  resolved: 'outline',
  dismissed: 'outline',
  merged_into: 'outline',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANTS[status] ?? 'outline'}>{status}</Badge>;
}
