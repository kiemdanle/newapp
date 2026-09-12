import React, { memo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Review, ReviewRating } from '@expyrico/shared';
import { Avatar } from '../../components/Avatar';
import { useSessionStore } from '../../auth/session-store';
import { isUserOwnReview } from '../../api/reviews';
import { useTheme } from '../../theme/useTheme';
import { useProduct } from '../../api/products';
import { ProductThumbnail } from '../../components/ProductThumbnail';

export interface ReviewCardProps {
  review: Review;
  onVoteHelpful?: (reviewId: string, currentVote: 'helpful' | 'not_helpful' | null) => void;
  showProductMeta?: boolean;
}

export function formatRelativeDate(isoDateString: string): string {
  const date = new Date(isoDateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  const diffYears = Math.floor(diffDays / 365);
  return `${diffYears}y ago`;
}

export const ReviewCard = memo(function ReviewCard({
  review,
  onVoteHelpful,
  showProductMeta = false,
}: ReviewCardProps) {
  const theme = useTheme();
  const { data: fetchedProduct } = useProduct(review.productId);
  const product = review.product ?? fetchedProduct;
  const productName = product?.name ?? fetchedProduct?.name ?? review.product?.name ?? 'Product';
  const productBrand = product?.brand ?? fetchedProduct?.brand ?? review.product?.brand;
  const authorName = review.author?.firstName ?? 'Community Member';
  const relativeDate = formatRelativeDate(review.createdAt);
  const currentUserId = useSessionStore((s) => s.user?.id);
  const isOwn = isUserOwnReview(review, currentUserId);
  const stars = review.stars ?? (review.rating === 'buy_again' ? 5 : review.rating === 'buy_again_on_sale' ? 3 : review.rating === 'wont_buy' ? 1 : 5);
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
      {/* Top Header: Author info and Recommendation Badge */}
      <View style={styles.headerRow}>
        <View style={styles.authorSection}>
          <Avatar
            url={review.author?.avatarUrl}
            firstName={authorName}
            size="sm"
          />
          <View style={styles.authorTextWrap}>
            <Text
              style={[styles.authorName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {authorName}
            </Text>
            <Text style={[styles.timestamp, { color: theme.colors.textMuted }]}>
              {relativeDate}
            </Text>
          </View>
        </View>

        {/* 5-Star Visual Indicator */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Ionicons
                key={s}
                name={s <= stars ? 'star' : 'star-outline'}
                size={14}
                color={s <= stars ? '#F5A623' : theme.colors.neutralMid}
                style={{ marginRight: 1 }}
              />
            ))}
          </View>
          <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text }}>
            {stars}.0
          </Text>
        </View>
      </View>

      {/* Optional Product Metadata Banner */}
      {showProductMeta && (product || review.product) ? (
        <View
          style={[
            styles.productMetaBanner,
            {
              backgroundColor: theme.colors.bg,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <ProductThumbnail
            product={product as any}
            photoUrl={review.product?.imageUrl ?? (product as any)?.imageUrl}
            size={36}
            fallbackIcon="cube-outline"
            style={{ marginRight: 8, width: 36, height: 36, borderRadius: 8 }}
          />
          <View style={{ flex: 1 }}>
            <Text
              style={[styles.productMetaName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {productName}
            </Text>
            {productBrand ? (
              <Text
                style={[styles.productMetaBrand, { color: theme.colors.textMuted }]}
                numberOfLines={1}
              >
                {productBrand}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}


      {/* Review Body Comment */}
      {review.body ? (
        <Text style={[styles.bodyText, { color: theme.colors.text }]}>
          {review.body}
        </Text>
      ) : null}

      {/* Footer: Helpful Vote CTA or Own Review Tag */}
      <View style={styles.footerRow}>
        {isOwn ? (
          <View
            style={[
              styles.ownReviewBadge,
              {
                backgroundColor: theme.colors.bg,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Ionicons
              name="person-outline"
              size={13}
              color={theme.colors.textMuted}
              style={{ marginRight: 4 }}
            />
            <Text style={[styles.ownReviewText, { color: theme.colors.textMuted }]}>
              Your review
            </Text>
          </View>
        ) : !isOwn && review.body && onVoteHelpful ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Vote helpful, currently ${review.helpfulCount} votes`}
            onPress={() => onVoteHelpful(review.id, review.myVote ?? null)}
            style={({ pressed }) => [
              styles.helpfulButton,
              {
                backgroundColor:
                  review.myVote === 'helpful'
                    ? theme.colors.primaryLight
                    : pressed
                      ? theme.colors.bgElevated
                      : theme.colors.bg,
                borderColor:
                  review.myVote === 'helpful'
                    ? theme.colors.primary
                    : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            hitSlop={8}
          >
            <Ionicons
              name={review.myVote === 'helpful' ? 'thumbs-up' : 'thumbs-up-outline'}
              size={15}
              color={
                review.myVote === 'helpful'
                  ? theme.colors.primaryDark
                  : theme.colors.textMuted
              }
            />
            <Text
              style={[
                styles.helpfulText,
                {
                  color:
                    review.myVote === 'helpful'
                      ? theme.colors.primaryDark
                      : theme.colors.textMuted,
                  fontWeight: review.myVote === 'helpful' ? '700' : '500',
                },
              ]}
            >
              Helpful ({review.helpfulCount})
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 10,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  authorTextWrap: {
    marginLeft: 10,
    flex: 1,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardStars: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  timestamp: {
    fontSize: 12,
    marginTop: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  productMetaBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 10,
  },
  productMetaName: {
    fontSize: 13,
    fontWeight: '600',
  },
  productMetaBrand: {
    fontSize: 11,
    marginTop: 1,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 32,
  },
  helpfulButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44, // >= 44pt touch target rule
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  helpfulText: {
    fontSize: 12,
    marginLeft: 6,
  },
  ownReviewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  ownReviewText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
