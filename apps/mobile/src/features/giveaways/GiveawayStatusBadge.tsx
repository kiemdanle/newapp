// apps/mobile/src/features/giveaways/GiveawayStatusBadge.tsx
import { Text } from 'react-native';
import type { GiveawayStatus } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';

const LABELS: Record<GiveawayStatus, string> = {
  open: 'Open',
  claimed: 'Claimed',
  handed_off: 'Handed off',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function GiveawayStatusBadge({ status }: { status: GiveawayStatus }) {
  const theme = useTheme();
  const colors: Record<GiveawayStatus, string> = {
    open: theme.colors.success,
    claimed: theme.colors.primary,
    handed_off: theme.colors.warning,
    completed: theme.colors.textMuted,
    cancelled: theme.colors.danger,
  };

  return (
    <Text
      style={{
        fontSize: 11,
        fontWeight: '600',
        color: colors[status],
        textTransform: 'uppercase',
      }}
    >
      {LABELS[status]}
    </Text>
  );
}
