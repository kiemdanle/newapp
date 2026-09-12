import React, { memo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Review, ReviewRating } from '@expyrico/shared';
import { formatRelativeDate } from './ReviewCard';
import { useTheme } from '../../theme/useTheme';
import { useProduct } from '../../api/products';
import { ProductThumbnail } from '../../components/ProductThumbnail';
export interface MyReviewCardProps {
  review: Review;
  onEdit: (productId: string, review?: Review) => void;
  onViewProduct: (productId: string) => void;
}

function getRatingStars(rating: ReviewRating): number {
  if (rating === 'buy_again') return 5;
  if (rating === 'buy_again_on_sale') return 3;
  if (rating === 'wont_buy') return 1;
  return 0;
}

export const MyReviewCard = memo(function MyReviewCard({
  review,
  onEdit,
  onViewProduct,
}: MyReviewCardProps) {
  const theme = useTheme();
  const { data: fetchedProduct } = useProduct(review.productId);
  const product = review.product ?? fetchedProduct;
  const productName = product?.name ?? fetchedProduct?.name ?? 'Product';
  const productBrand = product?.brand ?? fetchedProduct?.brand;
  const photoUrl = review.product?.imageUrl ?? (product as any)?.imageUrl;
  const relativeDate = formatRelativeDate(review.createdAt);
  const stars = review.stars ?? (review.rating ? getRatingStars(review.rating) : 5);
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
        },
      ]}
    >
      {/* Top Header: Product Avatar + Info & Recommendation Badge */}
      <View style={styles.headerRow}>
        <View style={styles.productLeftGroup}>
          <ProductThumbnail
            product={product as any}
            photoUrl={photoUrl}
            size={40}
            fallbackIcon="nutrition-outline"
            style={[
              styles.productAvatar,
              { borderColor: theme.colors.border },
            ]}
          />
          <View style={styles.productTextWrap}>
            <Text
              style={[styles.productName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {productName}
            </Text>
            {productBrand ? (
              <Text
                style={[styles.productBrand, { color: theme.colors.textMuted }]}
                numberOfLines={1}
              >
                {productBrand}
              </Text>
            ) : null}
          </View>
        </View>

      </View>

      {/* 5-Star Rating Row */}
      <View style={styles.starRow}>
        <View style={styles.starsGroup}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Ionicons
              key={s}
              name={s <= stars ? 'star' : 'star-outline'}
              size={15}
              color={s <= stars ? '#F5A623' : theme.colors.neutralMid}
              style={{ marginRight: 2 }}
            />
          ))}
        </View>
        <Text style={[styles.starScore, { color: theme.colors.text }]}>
          {stars}.0
        </Text>
        <Text style={[styles.dotDivider, { color: theme.colors.textMuted }]}>•</Text>
        <Text style={[styles.timestamp, { color: theme.colors.textMuted }]}>
          {relativeDate}
        </Text>
      </View>

      {/* Review Tasting Note */}
      {review.body ? (
        <View
          style={[
            styles.noteBox,
            {
              backgroundColor: theme.colors.bg,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Ionicons
            name="chatbox-ellipses-outline"
            size={14}
            color={theme.colors.primary}
            style={{ marginRight: 8, marginTop: 2 }}
          />
          <Text style={[styles.bodyText, { color: theme.colors.text }]}>
            {review.body}
          </Text>
        </View>
      ) : (
        <Text style={[styles.emptyBodyHint, { color: theme.colors.textMuted }]}>
          No written note added
        </Text>
      )}

      {/* Action Buttons */}
      <View
        style={[
          styles.actionsRow,
          { borderTopColor: theme.colors.border },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit review for ${productName}`}
          onPress={() => onEdit(review.productId, review)}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: pressed ? theme.colors.primaryLight : theme.colors.bg,
              borderColor: theme.colors.primary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="create-outline"
            size={16}
            color={theme.colors.primaryDark}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.actionText, { color: theme.colors.primaryDark }]}>
            Edit review
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View product ${productName}`}
          onPress={() => onViewProduct(review.productId)}
          style={({ pressed }) => [
            styles.actionButton,
            styles.actionButtonSecondary,
            {
              backgroundColor: pressed ? theme.colors.bgElevated : theme.colors.bg,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Text style={[styles.actionTextSecondary, { color: theme.colors.text }]}>
            View product
          </Text>
          <Ionicons
            name="chevron-forward"
            size={15}
            color={theme.colors.textMuted}
            style={{ marginLeft: 4 }}
          />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  productAvatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  productTextWrap: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  productBrand: {
    fontSize: 12,
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  starsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 6,
  },
  starScore: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 2,
  },
  dotDivider: {
    marginHorizontal: 6,
    fontSize: 12,
  },
  timestamp: {
    fontSize: 12,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  emptyBodyHint: {
    fontSize: 13,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 44, // >= 44pt touch target rule
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  actionButtonSecondary: {
    borderWidth: 1,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  actionTextSecondary: {
    fontSize: 13,
    fontWeight: '600',
  },
});
