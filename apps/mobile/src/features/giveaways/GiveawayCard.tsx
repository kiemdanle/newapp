// apps/mobile/src/features/giveaways/GiveawayCard.tsx
import { Pressable, Text, View } from 'react-native';
import type { Giveaway } from '@expyrico/shared';
import { GiveawayStatusBadge } from './GiveawayStatusBadge';

interface Props {
  giveaway: Giveaway;
  onPress?: (giveaway: Giveaway) => void;
}

export function GiveawayCard({ giveaway, onPress }: Props) {
  const loc = giveaway.locationText ?? '';

  return (
    <Pressable
      accessibilityLabel={`giveaway-${giveaway.id}`}
      onPress={() => onPress?.(giveaway)}
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 12,
        padding: 16,
        marginVertical: 6,
        borderWidth: 1,
        borderColor: '#e5e7eb',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: '#111827', flex: 1 }}>
          {giveaway.title}
        </Text>
        <GiveawayStatusBadge status={giveaway.status} />
      </View>
      {giveaway.description ? (
        <Text style={{ color: '#374151', marginTop: 4 }} numberOfLines={2}>
          {giveaway.description}
        </Text>
      ) : null}
      <Text style={{ color: '#6b7280', marginTop: 4 }}>
        📍 {loc}
        {giveaway.claimCount ? ` · ${giveaway.claimCount} claims` : ''}
      </Text>
      {giveaway.giver && (
        <View style={{ flexDirection: 'row', marginTop: 8, gap: 8, alignItems: 'center' }}>
          <Text style={{ color: '#6b7280', fontSize: 12 }}>
            {giveaway.giver.firstName}
          </Text>
          {giveaway.giver.giverRatingAvg != null && (
            <Text style={{ color: '#d97706', fontSize: 12 }}>
              ★ {giveaway.giver.giverRatingAvg.toFixed(1)}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
}
