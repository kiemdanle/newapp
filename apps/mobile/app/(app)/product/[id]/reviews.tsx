import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Review } from '@expyrico/shared';
import { Screen } from '../../../../src/components/Screen';
import { ProductThumbnail } from '../../../../src/components/ProductThumbnail';
import { ReviewCard } from '../../../../src/features/reviews/ReviewCard';
import { Button } from '../../../../src/components/Button';
import { useProduct } from '../../../../src/api/products';
import {
  useProductReviews,
  useMyProductReview,
  useVoteReviewHelpful,
  deduplicateReviews,
  isUserOwnReview,
} from '../../../../src/api/reviews';
import { useSessionStore } from '../../../../src/auth/session-store';
import { useTheme } from '../../../../src/theme/useTheme';
import type { AppNavigationProp } from '../../../../src/navigation/AppNavigator';

export default function ProductReviewsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute();
  const { id: productId } = route.params as { id: string };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStar, setSelectedStar] = useState<number | 'all'>('all');
  const [sort, setSort] = useState<'score' | 'new'>('score');

  const { data: product, isLoading: isLoadingProduct } = useProduct(productId);
  const { data: myReviewData } = useMyProductReview(productId);
  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    isRefetching,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useProductReviews(productId, { sort, limit: 20 });

  const voteMutation = useVoteReviewHelpful(productId);
  const currentUserId = useSessionStore((s) => s.user?.id);

  const rawReviews = deduplicateReviews(reviewsData?.pages);
  const myReview = myReviewData?.review;

  // Unify server product reviews with user's own review
  const allReviews = useMemo(() => {
    const map = new Map<string, Review>();
    if (myReview && myReview.status === 'visible') {
      map.set(myReview.id, myReview);
    }
    for (const r of rawReviews) {
      map.set(r.id, r);
    }
    return Array.from(map.values());
  }, [myReview, rawReviews]);

  // Client-side search and rating filter
  const reviews = useMemo(() => {
    return allReviews.filter((r) => {
      if (selectedStar !== 'all') {
        const itemStars = r.stars ?? (r.rating === 'buy_again' ? 5 : r.rating === 'buy_again_on_sale' ? 3 : 1);
        if (itemStars !== selectedStar) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const body = (r.body ?? '').toLowerCase();
        const author = (r.author?.firstName ?? '').toLowerCase();
        return body.includes(q) || author.includes(q);
      }
      return true;
    });
  }, [allReviews, selectedStar, searchQuery]);

  const existingReview =
    myReview ??
    allReviews.find((r) => isUserOwnReview(r, currentUserId)) ??
    null;
  const isReviewed = Boolean(existingReview);

  // Rating metrics: retain authoritative server tallies unless the review set is demonstrably complete
  const isCompleteSet = Boolean(
    product?.ratingCount &&
    !hasNextPage &&
    allReviews.length === product.ratingCount,
  );

  const totalRatings =
    isCompleteSet
      ? allReviews.length
      : (product?.ratingCount ?? allReviews.length);

  const buyAgain =
    isCompleteSet
      ? allReviews.filter((r) => r.rating === 'buy_again').length
      : (product?.buyAgainCount ?? allReviews.filter((r) => r.rating === 'buy_again').length);

  const buySale =
    isCompleteSet
      ? allReviews.filter((r) => r.rating === 'buy_again_on_sale').length
      : (product?.buyAgainOnSaleCount ?? allReviews.filter((r) => r.rating === 'buy_again_on_sale').length);

  const wontBuy =
    isCompleteSet
      ? allReviews.filter((r) => r.rating === 'wont_buy').length
      : (product?.wontBuyCount ?? allReviews.filter((r) => r.rating === 'wont_buy').length);

  const avgScore =
    totalRatings > 0
      ? Math.round(((buyAgain * 5 + buySale * 3 + wontBuy * 1) / totalRatings) * 10) / 10
      : 0;

  const scorePct =
    totalRatings > 0
      ? Math.round((avgScore / 5) * 100)
      : null;

  function handleNavigateWriteReview() {
    navigation.navigate('ProductReview', {
      id: productId,
      review: existingReview ?? undefined,
    });
  }

  function handleVoteHelpful(reviewId: string, currentVote: 'helpful' | 'not_helpful' | null) {
    voteMutation.mutate({ reviewId, currentVote });
  }

  const productName = product?.name ?? 'Product Details';
  const productBrand = product?.brand;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <Screen style={styles.screen} padded={false}>
        {/* Navigation Top Bar */}
        <View
          style={[
            styles.headerBar,
            { borderBottomColor: theme.colors.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </Pressable>

          <Text
            style={[styles.headerTitle, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            Product Reviews
          </Text>
          <View style={{ width: 44 }} />
        </View>

        {/* FlatList of Reviews with Header Component */}
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ReviewCard
              review={item}
              showProductMeta={false}
              onVoteHelpful={handleVoteHelpful}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={
            <View style={styles.headerContainer}>
              {/* Product Info Hero Banner */}
              <View
                style={[
                  styles.productHeroCard,
                  {
                    backgroundColor: theme.colors.bgElevated,
                    borderColor: theme.colors.border,
                    borderRadius: theme.radii.lg,
                  },
                ]}
              >
                <View style={styles.productTopRow}>
                  <ProductThumbnail
                    product={product}
                    size={56}
                    fallbackIcon="nutrition-outline"
                    style={[styles.productThumb, { borderColor: theme.colors.border }]}
                  />
                  <View style={styles.productMeta}>
                    <Text
                      style={[styles.productHeroName, { color: theme.colors.text }]}
                      numberOfLines={2}
                    >
                      {productName}
                    </Text>
                    {productBrand ? (
                      <Text
                        style={[styles.productHeroBrand, { color: theme.colors.textMuted }]}
                        numberOfLines={1}
                      >
                        {productBrand}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Aggregate Star & Score Section */}
                <View
                  style={[
                    styles.scoreHeroSection,
                    {
                      backgroundColor: theme.colors.bg,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={styles.bigScoreGroup}>
                    <Text style={[styles.bigScoreNum, { color: theme.colors.text }]}>
                      {avgScore.toFixed(1)}
                    </Text>
                    <View style={styles.bigStarsCol}>
                      <View style={{ flexDirection: 'row' }}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons
                            key={s}
                            name={s <= Math.round(avgScore) ? 'star' : 'star-outline'}
                            size={16}
                            color={s <= Math.round(avgScore) ? '#F5A623' : theme.colors.neutralMid}
                            style={{ marginRight: 2 }}
                          />
                        ))}
                      </View>
                      <Text style={[styles.bigScoreLabel, { color: theme.colors.textMuted }]}>
                        {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
                      </Text>
                    </View>
                  </View>

                  {scorePct !== null ? (
                    <View
                      style={[
                        styles.recommendPill,
                        {
                          backgroundColor: theme.colors.bgGlass,
                          borderColor: theme.colors.primary,
                        },
                      ]}
                    >
                      <Ionicons
                        name="star"
                        size={13}
                        color="#F5A623"
                        style={{ marginRight: 4 }}
                      />
                      <Text
                        style={[styles.recommendPillText, { color: theme.colors.primaryDark }]}
                      >
                        {scorePct}% score
                      </Text>
                    </View>
                  ) : null}
                </View>

                {/* Star Filter Pills Bar */}
                <View
                  style={[
                    styles.breakdownRow,
                    { borderTopColor: theme.colors.border },
                  ]}
                >
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Filter all stars"
                      onPress={() => setSelectedStar('all')}
                      style={[
                        styles.starFilterPill,
                        {
                          backgroundColor: selectedStar === 'all' ? theme.colors.primaryLight : 'transparent',
                          borderColor: selectedStar === 'all' ? theme.colors.primary : theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.starFilterText,
                          { color: selectedStar === 'all' ? theme.colors.primaryDark : theme.colors.textMuted },
                        ]}
                      >
                        All ({totalRatings})
                      </Text>
                    </Pressable>

                    {[5, 4, 3, 2, 1].map((s) => {
                      const count = allReviews.filter(
                        (r) => (r.stars ?? (r.rating === 'buy_again' ? 5 : r.rating === 'buy_again_on_sale' ? 3 : 1)) === s,
                      ).length;
                      const isActive = selectedStar === s;
                      return (
                        <Pressable
                          key={s}
                          accessibilityRole="button"
                          accessibilityLabel={`Filter ${s} stars`}
                          onPress={() => setSelectedStar(isActive ? 'all' : s)}
                          style={[
                            styles.starFilterPill,
                            {
                              backgroundColor: isActive ? theme.colors.primaryLight : 'transparent',
                              borderColor: isActive ? theme.colors.primary : theme.colors.border,
                            },
                          ]}
                        >
                          <Ionicons name="star" size={12} color="#F5A623" style={{ marginRight: 3 }} />
                          <Text
                            style={[
                              styles.starFilterText,
                              { color: isActive ? theme.colors.primaryDark : theme.colors.text },
                            ]}
                          >
                            {s} ({count})
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>

              {/* Write/Edit Review CTA Button */}
              <View style={styles.ctaRow}>
                <Button
                  testID="product-reviews-write-cta"
                  label={isReviewed ? 'Edit your review' : 'Write a review'}
                  variant={isReviewed ? 'outline' : 'primary'}
                  icon={isReviewed ? 'create-outline' : 'add-circle-outline'}
                  onPress={handleNavigateWriteReview}
                />
              </View>

              {/* Search Bar for this product's reviews */}
              <View style={styles.searchBoxWrap}>
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: theme.colors.bgElevated,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="search-outline"
                    size={18}
                    color={theme.colors.textMuted}
                    style={{ marginRight: 8 }}
                  />
                  <TextInput
                    placeholder="Search in reviews or reviewer..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={[styles.searchInput, { color: theme.colors.text }]}
                    returnKeyType="search"
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.trim() ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Clear search"
                      onPress={() => setSearchQuery('')}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={theme.colors.textMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {/* Sort & Filter Controls Bar */}
              <View
                style={[
                  styles.filterControlsBar,
                  { borderBottomColor: theme.colors.border },
                ]}
              >
                <View style={styles.sortPillsRow}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sort by top helpful"
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
                    <Text style={{ marginRight: 4 }}>🔥</Text>
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
                      Top helpful
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sort by newest"
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
                    <Text style={{ marginRight: 4 }}>⏱️</Text>
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
                      Newest
                    </Text>
                  </Pressable>
                </View>

                {/* Clear Active Filter if set */}
                {selectedStar !== 'all' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear filter"
                    onPress={() => setSelectedStar('all')}
                    style={[styles.clearFilterChip, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}
                    hitSlop={8}
                  >
                    <Text style={[styles.clearFilterText, { color: theme.colors.text }]}>
                      Clear filter ({selectedStar}★) ✕
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          }
          ListEmptyComponent={
            isLoadingReviews ? (
              <View style={styles.centerBox}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
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
                <Ionicons
                  name="chatbubbles-outline"
                  size={36}
                  color={theme.colors.textMuted}
                  style={{ marginBottom: 8 }}
                />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  {searchQuery.trim() || selectedStar !== 'all'
                    ? 'No matching reviews found'
                    : 'No written reviews yet'}
                </Text>
                <Text
                  style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}
                >
                  {searchQuery.trim() || selectedStar !== 'all'
                    ? 'Try clearing the search query or rating filter.'
                    : 'Be the first to share your thoughts on this item!'}
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
        />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerContainer: {
    paddingTop: 12,
    marginBottom: 8,
  },
  productHeroCard: {
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  productTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  productThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    marginRight: 12,
  },
  productMeta: {
    flex: 1,
  },
  productHeroName: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  productHeroBrand: {
    fontSize: 13,
    marginTop: 2,
  },
  scoreHeroSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  bigScoreGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bigScoreNum: {
    fontSize: 28,
    fontWeight: '800',
    marginRight: 10,
  },
  bigStarsCol: {
    gap: 2,
  },
  bigScoreLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  recommendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  recommendPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  starFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  starFilterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ctaRow: {
    marginBottom: 12,
  },
  searchBoxWrap: {
    marginBottom: 10,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  filterControlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
  },
  sortPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortPill: {
    flexDirection: 'row',
    alignItems: 'center',
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
  clearFilterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  clearFilterText: {
    fontSize: 11,
    fontWeight: '600',
  },
  centerBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
