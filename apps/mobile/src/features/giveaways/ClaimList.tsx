// apps/mobile/src/features/giveaways/ClaimList.tsx
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Claim } from '@expyrico/shared';
import { useReputation } from '../../api/reputation';
import { useTheme } from '../../theme/useTheme';
import { formatDate } from '../../utils/country-format';
import { EmptyState } from '../../components/EmptyState';

interface Props {
  claims: Claim[];
  isGiver: boolean;
  selectedRecipientId: string | null;
  onSelect?: (claim: Claim) => void;
  selecting?: boolean;
}

export function ClaimList({
  claims,
  isGiver,
  selectedRecipientId,
  onSelect,
  selecting,
}: Props) {
  const theme = useTheme();
  const safeClaims = Array.isArray(claims) ? claims : (claims as unknown as { items?: Claim[] })?.items ?? [];

  if (safeClaims.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <EmptyState
          icon="people-outline"
          title="No claim requests yet"
          body="When neighbors request this item, their messages and trust ratings will appear here for you to choose a recipient."
        />
      </View>
    );
  }

  return (
    <FlatList
      data={safeClaims}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.listContent}
      renderItem={({ item }) => {
        const isSelected = item.status === 'selected' || item.claimerUserId === selectedRecipientId;
        return (
          <View
            style={[
              styles.claimCard,
              {
                backgroundColor: isSelected ? theme.colors.bgGlass : theme.colors.bgElevated,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            {/* Header: User Name + Badge */}
            <View style={styles.cardHeader}>
              <View style={styles.userMeta}>
                <View
                  style={[
                    styles.avatarPlaceholder,
                    { backgroundColor: theme.colors.primaryLight, borderRadius: theme.radii.pill },
                  ]}
                >
                  <Text style={[styles.avatarText, { color: theme.colors.primaryDark }]}>
                    {(item.claimer?.firstName ?? 'U')[0]?.toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text style={[styles.userName, { color: theme.colors.text }]}>
                    {item.claimer?.firstName ?? 'Neighbor'}
                  </Text>
                  {item.claimer && <ClaimerReputation userId={item.claimer.id} />}
                </View>
              </View>

              {isSelected ? (
                <View
                  style={[
                    styles.selectedBadge,
                    { backgroundColor: theme.colors.success + '1F', borderRadius: theme.radii.pill },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} style={{ marginRight: 4 }} />
                  <Text style={[styles.selectedBadgeText, { color: theme.colors.success }]}>
                    Selected
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Pickup Note Bubble */}
            {item.pickupNote ? (
              <View
                style={[
                  styles.noteBubble,
                  { backgroundColor: theme.colors.bg, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.noteLabel, { color: theme.colors.textMuted }]}>
                  Pickup Message:
                </Text>
                <Text style={[styles.noteText, { color: theme.colors.text }]}>
                  "{item.pickupNote}"
                </Text>
              </View>
            ) : null}

            {/* Timestamp & Action */}
            <View style={styles.cardFooter}>
              <Text style={[styles.timeText, { color: theme.colors.textMuted }]}>
                Requested {formatDate(item.createdAt)}
              </Text>

              {isGiver && !selectedRecipientId && item.status === 'requested' && onSelect && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`select-claim-${item.id}`}
                  disabled={selecting}
                  onPress={() => onSelect(item)}
                  style={({ pressed }) => [
                    styles.selectBtn,
                    {
                      backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
                      borderRadius: theme.radii.pill,
                      opacity: selecting ? 0.7 : 1,
                    },
                  ]}
                >
                  {selecting ? (
                    <ActivityIndicator size="small" color={theme.colors.primaryFg} style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name="checkmark-outline" size={16} color={theme.colors.primaryFg} style={{ marginRight: 4 }} />
                  )}
                  <Text style={[styles.selectBtnText, { color: theme.colors.primaryFg }]}>
                    {selecting ? 'Selecting…' : 'Select Recipient'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        );
      }}
    />
  );
}

function ClaimerReputation({ userId }: { userId: string }) {
  const theme = useTheme();
  const { data: rep } = useReputation(userId);
  if (!rep) return null;
  return (
    <View style={styles.reputationRow}>
      {rep.recipientRatingAvg != null && (
        <Text style={[styles.ratingStar, { color: theme.colors.accent }]}>
          ★ {rep.recipientRatingAvg.toFixed(1)}
        </Text>
      )}
      <Text style={[styles.txCount, { color: theme.colors.textMuted }]}>
        {rep.transactionCount} completed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 40,
    gap: 12,
  },
  claimCard: {
    padding: 16,
    borderWidth: 1,
    gap: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
  },
  reputationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  ratingStar: {
    fontSize: 12,
    fontWeight: '700',
  },
  txCount: {
    fontSize: 12,
  },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  noteBubble: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  noteText: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 38,
    justifyContent: 'center',
  },
  selectBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
