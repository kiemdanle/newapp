import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { Review, ReviewRating } from '@expyrico/shared';
import { ProductThumbnail } from '../../components/ProductThumbnail';
import { Avatar } from '../../components/Avatar';
import { formatRelativeDate } from './ReviewCard';
import { useProduct } from '../../api/products';
import { useTheme } from '../../theme/useTheme';
import type { AppNavigationProp } from '../../navigation/AppNavigator';

export interface ProductCommunityGroup {
  productId: string;
  product?: any;
  reviews: Review[];
  totalReviews: number;
  averageScore: number;
  recommendPercent: number | null;
  latestCreatedAt: string;
}

export interface ProductCommunityCardProps {
  group: ProductCommunityGroup;
  onVoteHelpful?: (reviewId: string, currentVote: 'helpful' | 'not_helpful' | null) => void;
}

export const ProductCommunityCard = memo(function ProductCommunityCard({
  group,
  onVoteHelpful,
}: ProductCommunityCardProps) {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const [isExpanded, setIsExpanded] = useState(false);

  const { data: fetchedProduct } = useProduct(group.productId);
  const product = fetchedProduct ? { ...group.product, ...fetchedProduct } : group.product;
  const productName = product?.name ?? 'Product';
  const productBrand = product?.brand;
  const photoUrl = product?.imageUrl;

  // Compute average score: preserve authoritative server tallies unless the review set is complete
  let avgScore = group.averageScore;
  let totalRatings = group.totalReviews;

  if (product && typeof product.ratingCount === 'number' && product.ratingCount > 0) {
    const isComplete = product.ratingCount === group.reviews.length;
    if (isComplete && group.reviews.length > 0) {
      let sum = 0;
      for (const r of group.reviews) {
        if (r.rating === 'buy_again') {
          sum += 5;
        } else if (r.rating === 'buy_again_on_sale') {
          sum += 3;
        } else if (r.rating === 'wont_buy') {
          sum += 1;
        }
      }
      avgScore = Math.round((sum / group.reviews.length) * 10) / 10;
      totalRatings = group.reviews.length;
    } else {
      const buyAgain = product.buyAgainCount ?? 0;
      const buySale = product.buyAgainOnSaleCount ?? 0;
      const wontBuy = product.wontBuyCount ?? 0;
      const count = product.ratingCount;
      avgScore = Math.round(((buyAgain * 5 + buySale * 3 + wontBuy * 1) / count) * 10) / 10;
      totalRatings = count;
    }
  }

  const scorePct = totalRatings > 0 ? Math.round((avgScore / 5) * 100) : null;
  // 1 to 3 newest review comments
  const displayReviews = isExpanded
    ? group.reviews
    : group.reviews.slice(0, Math.min(2, group.reviews.length));
  function handleOpenReviews() {
    navigation.navigate('ProductReviews', { id: group.productId });
  }

  function handleOpenProduct() {
    navigation.navigate('Product', { id: group.productId });
  }
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
      {/* Product Header Row */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View product details for ${productName}`}
        onPress={handleOpenProduct}
        style={styles.productHeader}
      >
        <ProductThumbnail
          product={product}
          photoUrl={photoUrl}
          size={50}
          fallbackIcon="nutrition-outline"
          style={[styles.productThumb, { borderColor: theme.colors.border }]}
        />
        <View style={styles.productMeta}>
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

          {/* Aggregate Rating Score Badge */}
          <View style={styles.scoreRow}>
            <View
              style={[
                styles.starScoreBadge,
                {
                  backgroundColor: theme.colors.bgGlass,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name="star" size={13} color="#F5A623" style={{ marginRight: 3 }} />
              <Text style={[styles.starScoreText, { color: theme.colors.primaryDark }]}>
                {avgScore.toFixed(1)}
              </Text>
            </View>

            {scorePct !== null ? (
              <Text style={[styles.recommendText, { color: theme.colors.textMuted }]}>
                {scorePct}% score · {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
              </Text>
            ) : (
              <Text style={[styles.recommendText, { color: theme.colors.textMuted }]}>
                {totalRatings} {totalRatings === 1 ? 'review' : 'reviews'}
              </Text>
            )}
          </View>
        </View>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.colors.textMuted}
          style={{ marginLeft: 4 }}
        />
      </Pressable>

      {/* Review Comments Snippets Header */}
      <View
        style={[
          styles.snippetsDivider,
          { borderTopColor: theme.colors.border },
        ]}
      >
        <Text style={[styles.snippetsTitle, { color: theme.colors.textMuted }]}>
          RECENT COMMUNITY REVIEWS
        </Text>
      </View>

      {/* Review Comments Snippets */}
      <View style={styles.reviewsList}>
        {displayReviews.map((rev) => {
          const authorName = rev.author?.firstName ?? 'Community Member';
          const relativeDate = formatRelativeDate(rev.createdAt);
          const stars = rev.stars ?? (rev.rating === 'buy_again' ? 5 : rev.rating === 'buy_again_on_sale' ? 3 : 1);
          return (
            <View
              key={rev.id}
              style={[
                styles.snippetItem,
                {
                  backgroundColor: theme.colors.bg,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.snippetTop}>
                <View style={styles.authorRow}>
                  <Avatar
                    url={rev.author?.avatarUrl}
                    firstName={authorName}
                    size="sm"
                  />
                  <View style={{ marginLeft: 8 }}>
                    <Text
                      style={[styles.authorName, { color: theme.colors.text }]}
                      numberOfLines={1}
                    >
                      {authorName}
                    </Text>
                    <Text
                      style={[styles.relativeDate, { color: theme.colors.textMuted }]}
                    >
                      {relativeDate}
                    </Text>
                  </View>
                </View>

                {/* Star Rating */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Ionicons
                      key={s}
                      name={s <= stars ? 'star' : 'star-outline'}
                      size={13}
                      color={s <= stars ? '#F5A623' : theme.colors.neutralMid}
                      style={{ marginRight: 1 }}
                    />
                  ))}
                </View>
              </View>

              {/* Comment Body */}
              {rev.body ? (
                <Text
                  style={[styles.commentBody, { color: theme.colors.text }]}
                  numberOfLines={isExpanded ? undefined : 3}
                >
                  "{rev.body}"
                </Text>
              ) : (
                <Text
                  style={[styles.noComment, { color: theme.colors.textMuted }]}
                >
                  Rated without written notes
                </Text>
              )}

              {/* Helpful vote action */}
              {onVoteHelpful ? (
                <View style={styles.helpfulRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Vote helpful, ${rev.helpfulCount} votes`}
                    onPress={() => onVoteHelpful(rev.id, rev.myVote ?? null)}
                    style={({ pressed }) => [
                      styles.helpfulBtn,
                      {
                        backgroundColor:
                          rev.myVote === 'helpful'
                            ? theme.colors.primaryLight
                            : pressed
                              ? theme.colors.bgElevated
                              : theme.colors.bg,
                        borderColor:
                          rev.myVote === 'helpful'
                            ? theme.colors.primary
                            : theme.colors.border,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                    hitSlop={8}
                  >
                    <Ionicons
                      name={rev.myVote === 'helpful' ? 'thumbs-up' : 'thumbs-up-outline'}
                      size={13}
                      color={
                        rev.myVote === 'helpful'
                          ? theme.colors.primaryDark
                          : theme.colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.helpfulCount,
                        {
                          color:
                            rev.myVote === 'helpful'
                              ? theme.colors.primaryDark
                              : theme.colors.textMuted,
                        },
                      ]}
                    >
                      Helpful ({rev.helpfulCount})
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Read All Reviews Button */}
      <View style={styles.footerActionRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Read all ${totalRatings} reviews for ${productName}`}
          onPress={handleOpenReviews}
          style={({ pressed }) => [
            styles.readAllBtn,
            {
              backgroundColor: pressed ? theme.colors.primaryLight : theme.colors.bg,
              borderColor: theme.colors.primary,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          hitSlop={8}
        >
          <Ionicons
            name="chatbubbles-outline"
            size={16}
            color={theme.colors.primaryDark}
            style={{ marginRight: 6 }}
          />
          <Text style={[styles.readAllText, { color: theme.colors.primaryDark }]}>
            Read all reviews ({totalRatings})
          </Text>
          <Ionicons
            name="arrow-forward"
            size={14}
            color={theme.colors.primaryDark}
            style={{ marginLeft: 6 }}
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
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  productThumb: {
    width: 50,
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 12,
  },
  productMeta: {
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
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  starScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  starScoreText: {
    fontSize: 12,
    fontWeight: '800',
  },
  recommendText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  snippetsDivider: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginBottom: 8,
  },
  snippetsTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  reviewsList: {
    gap: 8,
    marginBottom: 14,
  },
  snippetItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  snippetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  authorName: {
    fontSize: 13,
    fontWeight: '700',
  },
  relativeDate: {
    fontSize: 11,
  },
  sentimentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  sentimentText: {
    fontSize: 11,
    fontWeight: '700',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  commentBody: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
  },
  noComment: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  helpfulRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  helpfulBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 32,
  },
  helpfulCount: {
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  footerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  readAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    minHeight: 44, // >= 44pt touch target rule
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  readAllText: {
    fontSize: 13,
    fontWeight: '700',
  },
});
