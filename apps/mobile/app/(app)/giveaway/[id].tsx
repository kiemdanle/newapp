// apps/mobile/app/(app)/giveaway/[id].tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  useGiveaway,
  useCancelGiveaway,
  useConfirmReceived,
  useHandOffGiveaway,
  useUpdateGiveaway,
} from '@/api/giveaways';
import { useReputation } from '@/api/reputation';
import { GiveawayStatusBadge } from '@/features/giveaways/GiveawayStatusBadge';
import { ClaimButton } from '@/features/giveaways/ClaimButton';
import { GiveawayImageGallery } from '@/features/giveaways/GiveawayImageGallery';
import { GiveawayQuickEditModal } from '@/features/giveaways/GiveawayQuickEditModal';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { useSessionStore } from '@/auth/session-store';
import { useTheme } from '@/theme/useTheme';
import { formatDate, formatDateTime } from '@/utils/country-format';
import type { AppNavigationProp } from '@/navigation/AppNavigator';

function getRelativeDateLabel(dateStr?: string | null, country?: string | null): string {
  if (!dateStr) return 'No expiry set';
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < 0) return 'Expired';
  if (diffHours < 24) return `In ${diffHours}h`;
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  return formatDate(dateStr, country, { style: 'short' });
}
export default function GiveawayDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const insets = useSafeAreaInsets();
  const route = useRoute();
  const { id } = route.params as { id: string };

  const { data: giveaway, isLoading, refetch } = useGiveaway(id ?? '');
  const user = useSessionStore((s) => s.user);
  const userId = user?.id ?? null;
  const userCountry = user?.country ?? null;
  const cancel = useCancelGiveaway();
  const handOff = useHandOffGiveaway();
  const confirm = useConfirmReceived();
  const updateGiveaway = useUpdateGiveaway();
  const [showEditModal, setShowEditModal] = useState(false);

  const isGiver = Boolean(userId && giveaway && userId === giveaway.giverUserId);
  const isSelectedRecipient = Boolean(userId && giveaway && userId === giveaway.selectedRecipientId);

  const photoList = useMemo(() => {
    if (!giveaway) return [];
    if (giveaway.photoUrls && Array.isArray(giveaway.photoUrls) && giveaway.photoUrls.length > 0) {
      return giveaway.photoUrls;
    }
    if (giveaway.photoUrl) {
      const raw = giveaway.photoUrl.trim();
      if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.filter((s): s is string => typeof s === 'string' && s.length > 0);
          }
        } catch {
          return [raw];
        }
      }
      return [raw];
    }
    return [];
  }, [giveaway]);

  const handleShare = useCallback(() => {
    if (!giveaway) return;
    void Share.share({
      message: `Check out this giveaway on Expyrico: ${giveaway.title} in ${giveaway.locationText}`,
      title: giveaway.title,
    });
  }, [giveaway]);

  const handleCancelConfirm = useCallback(() => {
    if (!giveaway) return;
    Alert.alert(
      'Cancel Giveaway',
      `Are you sure you want to cancel "${giveaway.title}"? It will be closed and removed from active listings.`,
      [
        { text: 'Keep item', style: 'cancel' },
        {
          text: 'Cancel Giveaway',
          style: 'destructive',
          onPress: async () => {
            await cancel.mutateAsync(giveaway.id);
            void refetch();
          },
        },
      ],
    );
  }, [giveaway, cancel, refetch]);

  const handleSaveEdit = useCallback(
    async (patch: {
      title: string;
      locationText: string;
      description?: string;
      photoUrl?: string | null;
      photoUrls?: string[];
    }) => {
      if (!giveaway) return;
      await updateGiveaway.mutateAsync({
        id: giveaway.id,
        patch,
      });
      void refetch();
    },
    [giveaway, updateGiveaway, refetch],
  );

  if (isLoading || !giveaway) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
          Loading giveaway details…
        </Text>
      </View>
    );
  }
  const effectiveCountry = userCountry || giveaway.country;
  const claimExpiryLabel = getRelativeDateLabel(giveaway.claimExpiresAt, effectiveCountry);
  const statusBadgeColor =
    giveaway.status === 'open'
      ? theme.colors.primary
      : giveaway.status === 'claimed'
        ? theme.colors.accent
        : giveaway.status === 'handed_off'
          ? theme.colors.success
          : giveaway.status === 'completed'
            ? theme.colors.textMuted
            : theme.colors.danger;
  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 110,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Gallery / Hero Media */}
        <GiveawayImageGallery photos={photoList} title={giveaway.title} />

        {/* Title & Quick Actions Header Row */}
        <View style={styles.titleCard}>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.categoryRow}>
              <Text style={[styles.categoryTag, { color: theme.colors.primaryDark }]}>
                GIVEAWAY
              </Text>
              <GiveawayStatusBadge status={giveaway.status} />
            </View>
            <Text
              style={[styles.titleText, { color: theme.colors.text }]}
              numberOfLines={2}
            >
              {giveaway.title}
            </Text>
            <Text style={[styles.locationSubtext, { color: theme.colors.textMuted }]}>
              📍 {giveaway.locationText}
            </Text>
          </View>

          {/* Quick Header Buttons */}
          <View style={styles.headerIcons}>
            {isGiver && (giveaway.status === 'open' || giveaway.status === 'claimed') ? (
              <>
                <Pressable
                  testID="giveaway-edit-header-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Edit giveaway"
                  onPress={() => setShowEditModal(true)}
                  style={({ pressed }) => [
                    styles.editPillBtn,
                    {
                      backgroundColor: theme.colors.primaryLight,
                      borderColor: theme.colors.primary,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Ionicons name="pencil" size={14} color={theme.colors.primaryDark} />
                  <Text style={[styles.editPillText, { color: theme.colors.primaryDark }]}>
                    Edit
                  </Text>
                </Pressable>
                <Pressable
                  testID="giveaway-delete-header-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Cancel giveaway"
                  onPress={handleCancelConfirm}
                  style={({ pressed }) => [
                    styles.iconBtn,
                    {
                      backgroundColor: theme.colors.bgElevated,
                      borderColor: theme.colors.border,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
                </Pressable>
              </>
            ) : (
              <Pressable
                testID="giveaway-share-header-btn"
                accessibilityRole="button"
                accessibilityLabel="Share giveaway"
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.iconBtn,
                  {
                    backgroundColor: theme.colors.bgElevated,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Ionicons name="share-social-outline" size={18} color={theme.colors.text} />
              </Pressable>
            )}
          </View>
        </View>

        {/* 2-Column Bento Stat Cards: Status & Claims */}
        <View style={styles.bentoRow}>
          {/* Status Bento Card */}
          <View
            style={[
              styles.bentoCard,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.bentoHeader}>
              <View style={[styles.statusDot, { backgroundColor: statusBadgeColor }]} />
              <Text style={[styles.bentoLabel, { color: theme.colors.textMuted }]}>
                STATUS
              </Text>
            </View>
            <Text
              style={[styles.bentoValue, { color: statusBadgeColor }]}
              numberOfLines={1}
            >
              {giveaway.status.toUpperCase()}
            </Text>
            <Text style={[styles.bentoSubtext, { color: theme.colors.textMuted }]}>
              {giveaway.claimExpiresAt
                ? `Expires ${claimExpiryLabel}`
                : 'Active neighborhood offer'}
            </Text>
          </View>

          {/* Claims Bento Card */}
          <View
            style={[
              styles.bentoCard,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.bentoHeader}>
              <Ionicons name="people-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.bentoLabel, { color: theme.colors.textMuted }]}>
                REQUESTS
              </Text>
            </View>
            <View style={styles.qtyMainRow}>
              <Text style={[styles.qtyValueText, { color: theme.colors.text }]}>
                {giveaway.claimCount ?? 0}
              </Text>
              <Text style={[styles.qtyUnitText, { color: theme.colors.textMuted }]}>
                claims
              </Text>
            </View>
            <Text style={[styles.bentoSubtext, { color: theme.colors.textMuted }]}>
              {giveaway.myClaim ? 'You requested this' : 'Neighbors interested'}
            </Text>
          </View>
        </View>

        {/* Giver Information Bento Card */}
        {giveaway.giver && (
          <View
            style={[
              styles.giverCard,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.giverLeftWrap}>
              <Avatar
                url={giveaway.giver.avatarUrl}
                name={giveaway.giver.firstName}
                size="md"
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.giverSectionLabel, { color: theme.colors.primaryDark }]}>
                  SHARED BY NEIGHBOR
                </Text>
                <Text style={[styles.giverFullName, { color: theme.colors.text }]}>
                  {giveaway.giver.firstName}
                </Text>
                <GiverReputation userId={giveaway.giver.id} />
              </View>
            </View>

            <View style={[styles.verifiedBadge, { backgroundColor: theme.colors.primaryLight }]}>
              <Ionicons name="shield-checkmark" size={14} color={theme.colors.primaryDark} />
              <Text style={[styles.verifiedText, { color: theme.colors.primaryDark }]}>
                Verified
              </Text>
            </View>
          </View>
        )}

        {/* Giveaway Details Bento Card */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Giveaway Information
          </Text>

          <View style={styles.specRow}>
            <View style={styles.specLabelWrap}>
              <Ionicons name="location-outline" size={15} color={theme.colors.textMuted} />
              <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>
                Neighborhood
              </Text>
            </View>
            <Text style={[styles.specValue, { color: theme.colors.text }]}>
              {giveaway.locationText}
            </Text>
          </View>

          {giveaway.country ? (
            <View style={styles.specRow}>
              <View style={styles.specLabelWrap}>
                <Ionicons name="globe-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>
                  Country
                </Text>
              </View>
              <Text style={[styles.specValue, { color: theme.colors.text }]}>
                {giveaway.country}
              </Text>
            </View>
          ) : null}
          {giveaway.claimExpiresAt ? (
            <View style={styles.specRow}>
              <View style={styles.specLabelWrap}>
                <Ionicons name="timer-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>
                  Claim Window
                </Text>
              </View>
              <Text style={[styles.specValue, { color: theme.colors.text }]}>
                {formatDateTime(giveaway.claimExpiresAt, effectiveCountry)}
              </Text>
            </View>
          ) : null}

          <View style={styles.specRow}>
            <View style={styles.specLabelWrap}>
              <Ionicons name="calendar-outline" size={15} color={theme.colors.textMuted} />
              <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>
                Listed Date
              </Text>
            </View>
            <Text style={[styles.specValue, { color: theme.colors.text }]}>
              {formatDate(giveaway.createdAt, effectiveCountry)}
            </Text>
          </View>

          {/* Description / Notes Box */}
          {giveaway.description ? (
            <View
              style={[
                styles.notesBox,
                {
                  backgroundColor: theme.colors.bgGlass,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.notesLabel, { color: theme.colors.primaryDark }]}>
                NOTES & DETAILS
              </Text>
              <Text style={[styles.notesContent, { color: theme.colors.text }]}>
                {giveaway.description}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating Bottom Action Toolbar */}
      <View
        style={[
          styles.actionToolbar,
          {
            backgroundColor: theme.colors.bgElevated,
            borderTopColor: theme.colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={styles.actionRow}>
          {/* Non-giver: Claim or Request Status */}
          {giveaway.status === 'open' && !isGiver && (
            <>
              <View style={{ flex: 1.8 }}>
                <ClaimButton
                  giveawayId={giveaway.id}
                  disabled={Boolean(giveaway.myClaim)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Share"
                  icon="share-social-outline"
                  variant="outline"
                  onPress={handleShare}
                />
              </View>
            </>
          )}

          {/* Giver: Manage Claims */}
          {isGiver && giveaway.status === 'open' && (
            <>
              <View style={{ flex: 1.8 }}>
                <Button
                  label={
                    giveaway.claimCount && giveaway.claimCount > 0
                      ? `Manage Claims (${giveaway.claimCount})`
                      : 'Manage Claims'
                  }
                  icon="people-outline"
                  variant="primary"
                  onPress={() => navigation.push('GiveawayManage', { id: giveaway.id })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  label="Cancel"
                  icon="close-circle-outline"
                  variant="outline"
                  onPress={handleCancelConfirm}
                />
              </View>
            </>
          )}

          {/* Giver: Mark Handed Off */}
          {isGiver && giveaway.status === 'claimed' && (
            <View style={{ flex: 1 }}>
              <Button
                label={handOff.isPending ? 'Marking…' : 'Mark as handed off'}
                icon="checkmark-circle-outline"
                variant="primary"
                loading={handOff.isPending}
                disabled={handOff.isPending}
                onPress={() => handOff.mutate(giveaway.id)}
              />
            </View>
          )}

          {/* Recipient: Confirm Received */}
          {isSelectedRecipient && giveaway.status === 'handed_off' && (
            <View style={{ flex: 1 }}>
              <Button
                label={confirm.isPending ? 'Confirming…' : 'Confirm received'}
                icon="checkmark-done-circle-outline"
                variant="primary"
                loading={confirm.isPending}
                disabled={confirm.isPending}
                onPress={() => confirm.mutate(giveaway.id)}
              />
            </View>
          )}

          {/* Completed: Rate Transaction */}
          {giveaway.status === 'completed' && (isGiver || isSelectedRecipient) && (
            <View style={{ flex: 1 }}>
              <Button
                label="Rate transaction"
                icon="star-outline"
                variant="primary"
                onPress={() => navigation.push('GiveawayRate', { id: giveaway.id })}
              />
            </View>
          )}

          {/* Cancelled state banner */}
          {giveaway.status === 'cancelled' && (
            <View style={styles.cancelledBanner}>
              <Ionicons name="information-circle" size={18} color={theme.colors.danger} />
              <Text style={[styles.cancelledText, { color: theme.colors.danger }]}>
                This giveaway has been cancelled.
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Quick Edit Modal */}
      <GiveawayQuickEditModal
        visible={showEditModal}
        giveaway={giveaway}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
      />
    </View>
  );
}

function GiverReputation({ userId }: { userId: string }) {
  const theme = useTheme();
  const { data: rep } = useReputation(userId);
  if (!rep) return null;
  return (
    <View style={styles.repRow}>
      {rep.giverRatingAvg != null && (
        <Text style={[styles.ratingPill, { color: theme.colors.accent }]}>
          ★ {rep.giverRatingAvg.toFixed(1)}
        </Text>
      )}
      <Text style={[styles.txCount, { color: theme.colors.textMuted }]}>
        {rep.transactionCount} {rep.transactionCount === 1 ? 'gift' : 'gifts'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    fontSize: 14,
  },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  categoryTag: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  locationSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  editPillBtn: {
    minHeight: 38,
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1,
  },
  editPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  iconBtn: {
    width: 38,
    height: 38,
    minWidth: 38,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 120,
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bentoLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  bentoValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  bentoSubtext: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  qtyMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  qtyValueText: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },
  qtyUnitText: {
    fontSize: 15,
    fontWeight: '600',
  },
  giverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  giverLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  giverSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  giverFullName: {
    fontSize: 15,
    fontWeight: '700',
  },
  repRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingPill: {
    fontSize: 12,
    fontWeight: '700',
  },
  txCount: {
    fontSize: 12,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specLabel: {
    fontSize: 13,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
    marginTop: 2,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  notesContent: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  cancelledBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  cancelledText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
