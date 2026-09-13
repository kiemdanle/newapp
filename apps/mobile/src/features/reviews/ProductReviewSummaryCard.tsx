import React, { memo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';

export interface ProductReviewSummaryCardProps {
  productId?: string | null;
  product?: Product | null;
  onPressViewReviews?: () => void;
  onPressWriteReview?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export const ProductReviewSummaryCard = memo(function ProductReviewSummaryCard({
  productId,
  product,
  onPressViewReviews,
  onPressWriteReview,
  style,
  testID = 'product-review-summary-card',
}: ProductReviewSummaryCardProps) {
  const theme = useTheme();
  const isDark = theme.scheme === 'dark';

  if (!productId) return null;

  const totalRatings = product?.ratingCount ?? 0;
  const buyAgainCount = product?.buyAgainCount ?? 0;
  const buyAgainOnSaleCount = product?.buyAgainOnSaleCount ?? 0;
  const positiveRatings = buyAgainCount + buyAgainOnSaleCount;
  const recommendPct =
    totalRatings > 0 ? Math.round((positiveRatings / totalRatings) * 100) : null;


  // Unrated state
  if (totalRatings === 0) {
    return (
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel="No community reviews yet. Tap to write a review."
        onPress={onPressWriteReview}
        hitSlop={6}
        style={({ pressed }) => [
          styles.inlineRow,
          { opacity: pressed ? 0.7 : 1 },
          style,
        ]}
      >
        <View
          style={[
            styles.unratedBadge,
            {
              backgroundColor: isDark ? theme.colors.bgGlass : theme.colors.primaryLight,
              borderColor: isDark ? 'rgba(75, 174, 138, 0.3)' : theme.colors.primary,
            },
          ]}
        >
          <Ionicons name="chatbox-ellipses-outline" size={12} color={theme.colors.primary} />
          <Text style={[styles.unratedActionText, { color: theme.colors.primaryDark }]}>
            Rate this item
          </Text>
        </View>

        <Text style={[styles.unratedSubtext, { color: theme.colors.textMuted }]}>
          Be the first to review
        </Text>
        <Ionicons name="chevron-forward" size={12} color={theme.colors.textMuted} />
      </Pressable>
    );
  }

  // Rated state
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Community review score: ${recommendPct}% recommend from ${totalRatings} ratings. Tap to view reviews.`}
      onPress={onPressViewReviews}
      hitSlop={6}
      style={({ pressed }) => [
        styles.inlineRow,
        { opacity: pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {/* Score and count pill */}
      <View style={styles.sentimentGroup}>
        <Ionicons name="thumbs-up" size={14} color={theme.colors.primary} />
        <Text style={[styles.scoreValue, { color: theme.colors.text }]}>
          {recommendPct}%
        </Text>
        <Text style={[styles.scoreLabel, { color: theme.colors.primary }]}>
          recommend
        </Text>
        <Text style={[styles.bulletDot, { color: theme.colors.textMuted }]}>·</Text>
        <Text style={[styles.ratingsCount, { color: theme.colors.textMuted }]}>
          {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={12} color={theme.colors.textMuted} style={{ marginLeft: 1 }} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  inlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  sentimentGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  bulletDot: {
    fontSize: 12,
    marginHorizontal: 1,
  },
  ratingsCount: {
    fontSize: 12,
    fontWeight: '500',
  },
  unratedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  unratedActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  unratedSubtext: {
    fontSize: 12,
    fontWeight: '500',
  },
});
