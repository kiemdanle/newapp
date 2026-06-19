// apps/mobile/src/features/giveaways/GiveawayStatusBadge.tsx
import { Text } from 'react-native';
import type { GiveawayStatus } from '@expyrico/shared';

const LABELS: Record<GiveawayStatus, string> = {
  open: 'Open',
  claimed: 'Claimed',
  handed_off: 'Handed off',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const COLORS: Record<GiveawayStatus, string> = {
  open: '#16a34a',
  claimed: '#2563eb',
  handed_off: '#d97706',
  completed: '#6b7280',
  cancelled: '#dc2626',
};

export function GiveawayStatusBadge({ status }: { status: GiveawayStatus }) {
  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '600',
        color: COLORS[status],
        textTransform: 'uppercase',
      }}
    >
      {LABELS[status]}
    </Text>
  );
}
