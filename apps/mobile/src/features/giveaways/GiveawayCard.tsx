// apps/mobile/src/features/giveaways/GiveawayCard.tsx
import { Pressable, Text, View } from 'react-native';
import type { Giveaway } from '@expyrico/shared';
import { GiveawayStatusBadge } from './GiveawayStatusBadge';
import { useTheme } from '../../theme/useTheme';

interface Props {
  giveaway: Giveaway;
  onPress?: (giveaway: Giveaway) => void;
}

export function GiveawayCard({ giveaway, onPress }: Props) {
  const theme = useTheme();
  const loc = giveaway.locationText ?? '';

  return (
    <Pressable
      accessibilityLabel={`giveaway-${giveaway.id}`}
      onPress={() => onPress?.(giveaway)}
      style={{
        backgroundColor: theme.colors.bgElevated,
        borderRadius: theme.radii.lg,
        padding: 16,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: theme.colors.border,
        shadowColor: theme.colors.neutralDark,
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
        minHeight: 124,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: theme.colors.text, flex: 1 }}>
          {giveaway.title}
        </Text>
        <GiveawayStatusBadge status={giveaway.status} />
      </View>
      {giveaway.description ? (
        <Text style={{ color: theme.colors.text, marginTop: 4 }} numberOfLines={2}>
          {giveaway.description}
        </Text>
      ) : null}
      <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>
        📍 {loc}
        {giveaway.claimCount ? ` · ${giveaway.claimCount} claims` : ''}
      </Text>
      {giveaway.giver && (
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
            {giveaway.giver.firstName}
          </Text>
          {giveaway.giver.giverRatingAvg != null && (
            <Text style={{ color: theme.colors.accent, fontSize: 12 }}>
              ★ {giveaway.giver.giverRatingAvg.toFixed(1)}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}
