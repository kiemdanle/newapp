import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product } from '@expyrico/shared';
import {
  useProductReviews,
  useMyProductReview,
  useVoteReviewHelpful,
  deduplicateReviews,
} from '../../api/reviews';
import { useSessionStore } from '../../auth/session-store';
import { isUserOwnReview } from '../../api/reviews';
import { ReviewCard } from './ReviewCard';
import { Button } from '../../components/Button';
import { useTheme } from '../../theme/useTheme';
import type { AppNavigationProp } from '../../navigation/AppNavigator';

export interface ProductReviewsSectionProps {
  product: Product;
}

export function ProductReviewsSection({ product }: ProductReviewsSectionProps) {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const [sort, setSort] = useState<'score' | 'new'>('score');

  const { data: myReviewData } = useMyProductReview(product.id);
  const { data: reviewsData, isLoading } = useProductReviews(product.id, { sort, limit: 10 });
  const voteMutation = useVoteReviewHelpful(product.id);

  const currentUserId = useSessionStore((s) => s.user?.id);
  const allReviews = deduplicateReviews(reviewsData?.pages);
  const existingReview =
    myReviewData?.review ??
    allReviews.find((r) => isUserOwnReview(r, currentUserId)) ??
    null;
  const isReviewed = Boolean(existingReview);

  // Sentiment metrics: retain authoritative server tallies unless the review set is demonstrably complete
  const isCompleteSet = Boolean(
    product.ratingCount &&
    allReviews.length === product.ratingCount,
  );

  const totalRatings =
    isCompleteSet ? allReviews.length : (product.ratingCount ?? 0);
  const avgScore =
    totalRatings > 0
      ? ((product as any).averageRating && Number((product as any).averageRating) > 0
          ? Number((product as any).averageRating)
          : allReviews.length > 0
            ? Math.round((allReviews.reduce((acc, r) => acc + (r.stars ?? (r.rating === 'buy_again' ? 5 : r.rating === 'buy_again_on_sale' ? 3 : 1)), 0) / allReviews.length) * 10) / 10
            : 0)
      : 0;
  const writtenReviewsCount = isCompleteSet
    ? allReviews.filter((r) => Boolean(r.body && r.body.trim())).length
    : (product.reviewCount ?? allReviews.filter((r) => Boolean(r.body && r.body.trim())).length);

  const displayReviews = allReviews.slice(0, 3);
  function handleNavigateReview() {
    navigation.navigate('ProductReview', {
      id: product.id,
      review: existingReview ?? undefined,
    });
  }

  function handleNavigateAllReviews() {
    navigation.navigate('ProductReviews', { id: product.id });
  }

  return (
    <View style={styles.container}>
      {/* Section Title */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
          Community Reviews
        </Text>
      </View>

      {/* Aggregate Sentiment Banner */}
      {totalRatings > 0 ? (
        <View
          style={[
            styles.sentimentBanner,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <View style={styles.sentimentHeader}>
            <Ionicons name="star" size={24} color="#F5A623" />
            <Text style={[styles.sentimentPct, { color: theme.colors.text }]}>
              {avgScore > 0 ? avgScore.toFixed(1) : '0.0'}
            </Text>
            <Text style={[styles.sentimentPctLabel, { color: theme.colors.textMuted }]}>
              out of 5 stars
            </Text>
          </View>
          <Text style={[styles.sentimentSub, { color: theme.colors.textMuted }]}>
            {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'} ({writtenReviewsCount} written {writtenReviewsCount === 1 ? 'review' : 'reviews'})
          </Text>
        </View>
      ) : (
        <View
          style={[
            styles.emptyCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <Ionicons name="chatbox-outline" size={32} color={theme.colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            No reviews yet
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
            Be the first to share your experience with this item.
          </Text>
        </View>
      )}

      {/* Review CTA Button */}
      <View style={styles.ctaRow}>
        <Button
          testID="product-review-cta"
          label={isReviewed ? 'Edit your review' : 'Write a review'}
          variant={isReviewed ? 'outline' : 'primary'}
          icon={isReviewed ? 'create-outline' : 'add-circle-outline'}
          onPress={handleNavigateReview}
        />
      </View>

      {/* Review Sort Controls & Feed */}
      {totalRatings > 0 ? (
        <>
          <View style={styles.sortBar}>
            <Text style={[styles.sortTitle, { color: theme.colors.text }]}>
              Recent Notes
            </Text>
            <View style={styles.sortPills}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sort reviews by top helpful"
                onPress={() => setSort('score')}
                style={({ pressed }) => [
                  styles.sortPill,
                  {
                    backgroundColor:
                      sort === 'score'
                        ? theme.colors.primaryLight
                        : pressed
                          ? theme.colors.bgElevated
                          : theme.colors.bg,
                    borderColor:
                      sort === 'score'
                        ? theme.colors.primary
                        : theme.colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.sortPillText,
                    {
                      color:
                        sort === 'score'
                          ? theme.colors.primaryDark
                          : theme.colors.textMuted,
                      fontWeight: sort === 'score' ? '700' : '500',
                    },
                  ]}
                >
                  🔥 Top helpful
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sort reviews by newest"
                onPress={() => setSort('new')}
                style={({ pressed }) => [
                  styles.sortPill,
                  {
                    backgroundColor:
                      sort === 'new'
                        ? theme.colors.primaryLight
                        : pressed
                          ? theme.colors.bgElevated
                          : theme.colors.bg,
                    borderColor:
                      sort === 'new'
                        ? theme.colors.primary
                        : theme.colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
                hitSlop={8}
              >
                <Text
                  style={[
                    styles.sortPillText,
                    {
                      color:
                        sort === 'new'
                          ? theme.colors.primaryDark
                          : theme.colors.textMuted,
                      fontWeight: sort === 'new' ? '700' : '500',
                    },
                  ]}
                >
                  ⏱️ Newest
                </Text>
              </Pressable>
            </View>
          </View>

          {isLoading ? (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          ) : (
            <View style={styles.reviewsList}>
              {displayReviews.map((r) => (
                <ReviewCard
                  key={r.id}
                  review={r}
                  showProductMeta={false}
                  onVoteHelpful={(reviewId, currentVote) =>
                    voteMutation.mutate({ reviewId, currentVote })
                  }
                />
              ))}

              {allReviews.length > 3 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="View all community reviews"
                  onPress={handleNavigateAllReviews}
                  style={styles.viewAllButton}
                  hitSlop={8}
                >
                  <Text style={[styles.viewAllText, { color: theme.colors.primaryDark }]}>
                    View all {allReviews.length} reviews
                  </Text>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={theme.colors.primaryDark}
                  />
                </Pressable>
              ) : null}
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sentimentBanner: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sentimentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  sentimentPct: {
    fontSize: 22,
    fontWeight: '800',
    marginLeft: 8,
    marginRight: 6,
  },
  sentimentPctLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  sentimentSub: {
    fontSize: 13,
    marginBottom: 12,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breakdownCount: {
    fontSize: 13,
    fontWeight: '700',
    marginRight: 4,
  },
  breakdownLabel: {
    fontSize: 12,
  },
  breakdownDot: {
    marginHorizontal: 8,
  },
  emptyCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
  },
  ctaRow: {
    marginBottom: 20,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sortTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sortPills: {
    flexDirection: 'row',
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
  },
  sortPillText: {
    fontSize: 12,
  },
  reviewsList: {
    gap: 4,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    paddingVertical: 10,
    marginTop: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 4,
  },
});
