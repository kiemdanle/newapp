// apps/mobile/src/features/giveaways/GiveawayStatusBadge.tsx
import { Text, View } from 'react-native';
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

  const color = colors[status];
  return <View accessibilityLabel={`Giveaway status: ${LABELS[status]}`} style={{ paddingHorizontal: 9, minHeight: 26, justifyContent: 'center', borderRadius: theme.radii.pill, backgroundColor: `${color}1F` }}><Text style={{ fontSize: 11, fontWeight: '800', color, textTransform: 'uppercase', letterSpacing: 0.4 }}>{LABELS[status]}</Text></View>;
}
