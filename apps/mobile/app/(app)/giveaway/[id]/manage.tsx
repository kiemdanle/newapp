// apps/mobile/app/(app)/giveaway/[id]/manage.tsx
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRoute } from '@react-navigation/native';
import { useGiveaway, useGiveawayClaims, useSelectClaim } from '@/api/giveaways';
import type { Claim } from '@expyrico/shared';
import { ClaimList } from '@/features/giveaways/ClaimList';
import { GiveawayStatusBadge } from '@/features/giveaways/GiveawayStatusBadge';
import { useTheme } from '@/theme/useTheme';

export default function ManageGiveawayScreen() {
  const theme = useTheme();
  const { id } = useRoute().params as { id: string };

  const { data: giveaway, isLoading: loadingGiveaway } = useGiveaway(id ?? '');
  const { data: claims, isLoading: loadingClaims, refetch } = useGiveawayClaims(id ?? '');
  const select = useSelectClaim();

  async function handleSelect(claim: Claim) {
    await select.mutateAsync({ giveawayId: id ?? '', claimId: claim.id });
    void refetch();
  }

  const isLoading = loadingGiveaway || loadingClaims;

  if (isLoading || !giveaway) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
          Loading claims…
        </Text>
      </View>
    );
  }

  const imageUrl = giveaway.photoUrl || (giveaway.photoUrls && giveaway.photoUrls[0]) || null;
  const safeClaims = Array.isArray(claims) ? claims : (claims as unknown as { items?: Claim[] })?.items ?? [];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Top Giveaway Summary Card */}
      <View
        style={[
          styles.summaryCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <View style={styles.summaryTop}>
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={[styles.thumbnail, { borderRadius: theme.radii.md }]}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.thumbnailPlaceholder,
                { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, borderRadius: theme.radii.md },
              ]}
            >
              <Ionicons name="gift-outline" size={24} color={theme.colors.primary} />
            </View>
          )}

          <View style={styles.summaryInfo}>
            <View style={styles.titleRow}>
              <Text style={[styles.giveawayTitle, { color: theme.colors.text }]} numberOfLines={2}>
                {giveaway.title}
              </Text>
              <GiveawayStatusBadge status={giveaway.status} />
            </View>

            <Text style={[styles.locationText, { color: theme.colors.textMuted }]}>
              📍 {giveaway.locationText}
            </Text>

            <Text style={[styles.claimsCount, { color: theme.colors.primaryDark }]}>
              {safeClaims.length} neighbor{safeClaims.length === 1 ? '' : 's'} requested this item
            </Text>
          </View>
        </View>
      </View>

      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Claim Requests
        </Text>
        <Pressable accessibilityRole="button" onPress={() => void refetch()} hitSlop={8}>
          <Text style={[styles.refreshText, { color: theme.colors.primaryDark }]}>Refresh ↻</Text>
        </Pressable>
      </View>

      {/* Claims List */}
      <View style={{ flex: 1 }}>
        <ClaimList
          claims={safeClaims}
          isGiver
          selectedRecipientId={giveaway.selectedRecipientId}
          onSelect={handleSelect}
          selecting={select.isPending}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    gap: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    padding: 14,
    borderWidth: 1,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  summaryTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 64,
    height: 64,
  },
  thumbnailPlaceholder: {
    width: 64,
    height: 64,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryInfo: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  giveawayTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  locationText: {
    fontSize: 13,
  },
  claimsCount: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  refreshText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
