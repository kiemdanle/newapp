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
  const isDark = theme.scheme === 'dark';
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

  // Expiry calculation with theme-aware calibrated styling
  let expiryLabel: string | null = null;
  let expiryBg = theme.colors.bgGlass;
  let expiryBorder = theme.colors.border;
  let expiryFg = theme.colors.textMuted;
  let expiryDot = theme.colors.textMuted;

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
        expiryBg = theme.colors.danger + (isDark ? '26' : '14');
        expiryBorder = theme.colors.danger + (isDark ? '66' : '3D');
        expiryFg = isDark ? theme.colors.text : theme.colors.danger;
        expiryDot = theme.colors.danger;
      } else if (diffDays === 0) {
        expiryLabel = 'Expires today';
        expiryBg = isDark ? theme.colors.warning + '26' : theme.colors.accentLight;
        expiryBorder = theme.colors.warning + (isDark ? '66' : '4D');
        expiryFg = isDark ? theme.colors.text : '#B45309';
        expiryDot = theme.colors.warning;
      } else if (diffDays === 1) {
        expiryLabel = 'Expires tomorrow';
        expiryBg = isDark ? theme.colors.warning + '26' : theme.colors.accentLight;
        expiryBorder = theme.colors.warning + (isDark ? '66' : '4D');
        expiryFg = isDark ? theme.colors.text : '#B45309';
        expiryDot = theme.colors.warning;
      } else if (diffDays <= 3) {
        expiryLabel = `Expires in ${diffDays}d`;
        expiryBg = isDark ? theme.colors.warning + '26' : theme.colors.accentLight;
        expiryBorder = theme.colors.warning + (isDark ? '66' : '4D');
        expiryFg = isDark ? theme.colors.text : '#B45309';
        expiryDot = theme.colors.warning;
      } else {
        const dayMonthStr = formatDate(deal.expiryDate, deal.country || userCountry, {
          style: 'dayMonth',
        });
        expiryLabel = `Best by ${dayMonthStr}`;
        expiryBg = theme.colors.primaryLight;
        expiryBorder = theme.colors.success + (isDark ? '50' : '33');
        expiryFg = isDark ? theme.colors.text : theme.colors.primaryDark;
        expiryDot = theme.colors.success;
      }
    }
  }

  return (
    <Pressable
      accessibilityLabel={`deal-${deal.id}`}
      onPress={() => onPress?.(deal)}
      onLongPress={() => onReport(deal)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          opacity: pressed ? 0.94 : 1,
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
              {
                backgroundColor: theme.colors.bgGlass,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
              },
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
            <View
              style={[
                styles.priceBadge,
                {
                  backgroundColor: isDark ? 'rgba(75, 174, 138, 0.20)' : theme.colors.primaryLight,
                  borderColor: isDark ? 'rgba(75, 174, 138, 0.40)' : 'rgba(75, 174, 138, 0.30)',
                },
              ]}
            >
              <Text
                style={[
                  styles.priceTag,
                  { color: isDark ? theme.colors.primary : theme.colors.primaryDark },
                ]}
              >
                {priceLabel}
              </Text>
            </View>
          </View>

          {deal.product?.brand ? (
            <Text
              style={[styles.brandText, { color: theme.colors.textMuted }]}
              numberOfLines={1}
            >
              {deal.product.brand}
            </Text>
          ) : null}

          {/* Badges: Store (Same Row!) + Expiry */}
          <View style={styles.badgeRow}>
            {deal.storeName ? (
              <View
                style={[
                  styles.storePill,
                  {
                    backgroundColor: theme.colors.bgGlass,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.pill,
                  },
                ]}
              >
                <Ionicons
                  name="storefront-outline"
                  size={12}
                  color={theme.colors.textMuted}
                />
                <Text
                  style={[styles.storeText, { color: theme.colors.text }]}
                  numberOfLines={1}
                >
                  {deal.storeName}
                </Text>
              </View>
            ) : null}

            {expiryLabel ? (
              <View
                style={[
                  styles.expiryPill,
                  {
                    backgroundColor: expiryBg,
                    borderColor: expiryBorder,
                    borderRadius: theme.radii.pill,
                  },
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    { backgroundColor: expiryDot },
                  ]}
                />
                <Text style={[styles.expiryText, { color: expiryFg }]}>
                  {expiryLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {deal.note ? (
        <View
          style={[
            styles.noteCard,
            {
              backgroundColor: theme.colors.bgGlass,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.sm,
            },
          ]}
        >
          <Ionicons
            name="chatbox-ellipses-outline"
            size={13}
            color={theme.colors.textMuted}
            style={{ marginTop: 2 }}
          />
          <Text
            style={[styles.noteText, { color: theme.colors.textMuted }]}
            numberOfLines={2}
          >
            {deal.note}
          </Text>
        </View>
      ) : null}

      {/* Bottom Footer: Author & Voting */}
      <View
        style={[
          styles.footerRow,
          { borderTopColor: theme.colors.border },
        ]}
      >
        <View style={styles.authorGroup}>
          <Ionicons
            name="person-circle-outline"
            size={16}
            color={theme.colors.textMuted}
          />
          <Text
            style={[styles.authorText, { color: theme.colors.textMuted }]}
            numberOfLines={1}
          >
            Shared by {deal.author?.firstName ?? 'Neighbor'}
          </Text>
        </View>

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
                    deal.myVote === 1
                      ? isDark
                        ? 'rgba(75, 174, 138, 0.22)'
                        : 'rgba(75, 174, 138, 0.16)'
                      : 'transparent',
                  borderColor:
                    deal.myVote === 1 ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="arrow-up"
                size={13}
                color={deal.myVote === 1 ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.voteCount,
                  {
                    color:
                      deal.myVote === 1 ? theme.colors.primary : theme.colors.textMuted,
                  },
                ]}
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
                    deal.myVote === -1
                      ? isDark
                        ? 'rgba(224, 68, 42, 0.22)'
                        : 'rgba(224, 68, 42, 0.14)'
                      : 'transparent',
                  borderColor:
                    deal.myVote === -1 ? theme.colors.danger : theme.colors.border,
                },
              ]}
            >
              <Ionicons
                name="arrow-down"
                size={13}
                color={deal.myVote === -1 ? theme.colors.danger : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.voteCount,
                  {
                    color:
                      deal.myVote === -1 ? theme.colors.danger : theme.colors.textMuted,
                  },
                ]}
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
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
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
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
    lineHeight: 20,
  },
  priceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 1,
  },
  priceTag: {
    fontSize: 14,
    fontWeight: '800',
  },
  brandText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  storePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  storeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expiryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
  },
  noteText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    fontStyle: 'italic',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  authorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
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
    gap: 4,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9999,
    minHeight: 28,
  },
  voteCount: {
    fontWeight: '700',
    fontSize: 12,
  },
});
