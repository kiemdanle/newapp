// apps/mobile/src/features/deals/DealCard.tsx
import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Deal } from '@expyrico/shared';
import { useOptimisticDealVote } from './useOptimisticDealVote';
import { useSessionStore } from '../../auth/session-store';
import { useTheme } from '../../theme/useTheme';
import { formatCurrency, formatDate } from '../../utils/country-format';
import { useCachedImage } from '../../cache/useCachedImage';
interface Props {
  deal: Deal;
  onReport: (deal: Deal) => void;
  onPress?: (deal: Deal) => void;
  isOwn?: boolean;
}

export function DealCard({ deal, onReport, onPress, isOwn }: Props) {
  const theme = useTheme();
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const vote = useOptimisticDealVote(deal.id);
  function press(next: -1 | 1) {
    const prev = deal.myVote ?? null;
    vote.mutate({ next: prev === next ? 0 : next, prev });
  }

  const priceLabel = formatCurrency(deal.price, deal.currency);
  const imageUrl = deal.photoUrl || deal.product?.imageUrl;
  const { uri: cachedImageUrl } = useCachedImage(imageUrl);
  const activeImageUrl = cachedImageUrl || imageUrl;
  // Expiry calculation
  let expiryLabel: string | null = null;
  let expiryBg = theme.colors.bgElevated;
  let expiryFg = theme.colors.textMuted;

  if (deal.expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [y, m, d] = deal.expiryDate.split('-').map(Number);
    if (y && m && d) {
      const expDate = new Date(y, m - 1, d);
      const diffDays = Math.ceil(
        (expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (diffDays < 0) {
        expiryLabel = 'Expired';
        expiryBg = '#FEE8E6';
        expiryFg = theme.colors.danger; // Alert Red #E0442A
      } else if (diffDays === 0) {
        expiryLabel = 'Expires today';
        expiryBg = '#FEEFC3'; // Soft Butter
        expiryFg = '#B45309'; // Honey
      } else if (diffDays === 1) {
        expiryLabel = 'Expires tomorrow';
        expiryBg = '#FEEFC3';
        expiryFg = '#B45309';
      } else if (diffDays <= 3) {
        expiryLabel = `Expires in ${diffDays}d`;
        expiryBg = '#FEEFC3';
        expiryFg = '#B45309';
      } else {
        const dayMonthStr = formatDate(deal.expiryDate, deal.country || userCountry, {
          style: 'dayMonth',
        });
        expiryLabel = `Best by ${dayMonthStr}`;
        expiryBg = '#D6F0E6'; // Mint Mist
        expiryFg = theme.colors.primaryDark; // Deep Sage #3A8F6F
      }
    }
  }

  return (
    <Pressable
      accessibilityLabel={`deal-${deal.id}`}
      onPress={() => onPress?.(deal)}
      onLongPress={() => onReport(deal)}
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
        {/* Product Thumbnail */}
        {activeImageUrl ? (
          <Image
            source={{ uri: activeImageUrl, cache: 'force-cache' }}
            style={[styles.thumbnail, { borderRadius: theme.radii.md }]}
            resizeMode="cover"
            fadeDuration={100}
          />
        ) : (
          <View
            style={[
              styles.thumbnailPlaceholder,
              { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radii.md },
            ]}
          >
            <Ionicons name="pricetag-outline" size={24} color={theme.colors.primary} />
          </View>
        )}

        {/* Product Info & Price */}
        <View style={styles.infoCol}>
          <View style={styles.titleRow}>
            <Text
              style={[styles.productName, { color: theme.colors.text }]}
              numberOfLines={2}
            >
              {deal.product?.name ?? 'Product'}
            </Text>
            <Text style={[styles.priceTag, { color: theme.colors.primaryDark }]}>
              {priceLabel}
            </Text>
          </View>

          {deal.product?.brand ? (
            <Text style={[styles.brandText, { color: theme.colors.textMuted }]}>
              {deal.product.brand}
            </Text>
          ) : null}

          {/* Badges: Store + Expiry */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.storePill,
                { backgroundColor: theme.colors.bg, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radii.sm },
              ]}
            >
              <Ionicons name="storefront-outline" size={12} color={theme.colors.textMuted} style={{ marginRight: 3 }} />
              <Text style={[styles.storeText, { color: theme.colors.text }]}>
                {deal.storeName}
              </Text>
            </View>
            {expiryLabel ? (
              <View
                style={[
                  styles.expiryPill,
                  { backgroundColor: expiryBg, borderRadius: theme.radii.sm },
                ]}
              >
                <Text style={[styles.expiryText, { color: expiryFg }]}>
                  {expiryLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {deal.note ? (
        <Text
          style={[styles.noteText, { color: theme.colors.text, backgroundColor: theme.colors.bg }]}
          numberOfLines={2}
        >
          {deal.note}
        </Text>
      ) : null}

      {/* Bottom Footer: Author & Voting */}
      <View style={[styles.footerRow, { borderTopColor: theme.colors.border }]}>
        <Text style={[styles.authorText, { color: theme.colors.textMuted }]}>
          Shared by {deal.author?.firstName ?? 'Neighbor'}
        </Text>

        {!isOwn && (
          <View style={styles.voteControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="upvote"
              onPress={() => press(1)}
              hitSlop={8}
              style={[
                styles.voteBtn,
                {
                  backgroundColor:
                    deal.myVote === 1 ? theme.colors.primary + '18' : 'transparent',
                  borderColor:
                    deal.myVote === 1 ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={13}
                color={deal.myVote === 1 ? theme.colors.primaryDark : theme.colors.textMuted}
                style={{ marginRight: 2 }}
              />
              <Text
                style={{
                  color: deal.myVote === 1 ? theme.colors.primaryDark : theme.colors.textMuted,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {deal.upvoteCount}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="downvote"
              onPress={() => press(-1)}
              hitSlop={8}
              style={[
                styles.voteBtn,
                {
                  backgroundColor:
                    deal.myVote === -1 ? theme.colors.danger + '18' : 'transparent',
                  borderColor:
                    deal.myVote === -1 ? theme.colors.danger : theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="arrow-down"
                size={13}
                color={deal.myVote === -1 ? theme.colors.danger : theme.colors.textMuted}
                style={{ marginRight: 2 }}
              />
              <Text
                style={{
                  color: deal.myVote === -1 ? theme.colors.danger : theme.colors.textMuted,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                {deal.downvoteCount}
              </Text>
            </Pressable>
          </View>
        )}
      </View>
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
    gap: 12,
  },
  thumbnail: {
    width: 68,
    height: 68,
  },
  thumbnailPlaceholder: {
    width: 68,
    height: 68,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoCol: {
    flex: 1,
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  priceTag: {
    fontSize: 17,
    fontWeight: '800',
  },
  brandText: {
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  storePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  storeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  expiryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  noteText: {
    fontSize: 13,
    marginTop: 10,
    padding: 8,
    borderRadius: 6,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  authorText: {
    fontSize: 12,
  },
  voteControls: {
    flexDirection: 'row',
    gap: 8,
  },
  voteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    minHeight: 32,
  },
});
