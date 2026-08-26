// apps/mobile/src/features/giveaways/GiveawayCard.tsx
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
  const imageUrl = giveaway.photoUrl || (giveaway.photoUrls && giveaway.photoUrls[0]) || null;

  return (
    <Pressable
      accessibilityLabel={`giveaway-${giveaway.id}`}
      onPress={() => onPress?.(giveaway)}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
        },
      ]}
    >
      <View style={styles.topRow}>
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.thumbnail, { borderRadius: theme.radii.md }]}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.thumbnailPlaceholder,
              {
                backgroundColor: theme.colors.bgGlass,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <Ionicons name="gift-outline" size={24} color={theme.colors.primary} />
          </View>
        )}

        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text style={[styles.titleText, { color: theme.colors.text }]} numberOfLines={2}>
              {giveaway.title}
            </Text>
            <GiveawayStatusBadge status={giveaway.status} />
          </View>

          {giveaway.description ? (
            <Text style={[styles.descText, { color: theme.colors.textMuted }]} numberOfLines={2}>
              {giveaway.description}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            <Text style={[styles.locationText, { color: theme.colors.textMuted }]} numberOfLines={1}>
              📍 {loc}
            </Text>
            {giveaway.claimCount ? (
              <Text style={[styles.claimCountText, { color: theme.colors.primaryDark }]}>
                · {giveaway.claimCount} requested
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {giveaway.giver && (
        <View style={[styles.footerRow, { borderTopColor: theme.colors.border }]}>
          <View style={styles.giverRow}>
            <Ionicons name="person-circle-outline" size={16} color={theme.colors.textMuted} />
            <Text style={[styles.giverName, { color: theme.colors.textMuted }]}>
              {giveaway.giver.firstName}
            </Text>
            {giveaway.giver.giverRatingAvg != null && (
              <Text style={[styles.ratingText, { color: theme.colors.accent }]}>
                ★ {giveaway.giver.giverRatingAvg.toFixed(1)}
              </Text>
            )}
          </View>
          <Text style={[styles.actionHint, { color: theme.colors.primaryDark }]}>
            View details →
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    marginVertical: 6,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumbnail: {
    width: 68,
    height: 68,
  },
  thumbnailPlaceholder: {
    width: 68,
    height: 68,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCol: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titleText: {
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
  },
  descText: {
    fontSize: 13,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    flexShrink: 1,
  },
  claimCountText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  giverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  giverName: {
    fontSize: 12,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionHint: {
    fontSize: 12,
    fontWeight: '700',
  },
});
