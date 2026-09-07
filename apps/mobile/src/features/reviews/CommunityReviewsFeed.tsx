import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  useCommunityReviews,
  useMyReviews,
  useVoteReviewHelpful,
  deduplicateReviews,
} from '../../api/reviews';
import { useTheme } from '../../theme/useTheme';
import { ProductCommunityCard, type ProductCommunityGroup } from './ProductCommunityCard';

export interface CommunityReviewsFeedProps {
  searchQuery?: string;
}

export function CommunityReviewsFeed({ searchQuery = '' }: CommunityReviewsFeedProps) {
  const theme = useTheme();
  const [sort, setSort] = useState<'score' | 'new'>('score');

  const {
    data,
    isLoading: isLoadingCommunity,
    isRefetching: isRefetchingCommunity,
    refetch: refetchCommunity,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useCommunityReviews({ sort });

  const {
    data: myReviewsData,
    isLoading: isLoadingMyReviews,
    isRefetching: isRefetchingMyReviews,
    refetch: refetchMyReviews,
  } = useMyReviews({ limit: 50 });

  const voteMutation = useVoteReviewHelpful();
  const communityReviews = deduplicateReviews(data?.pages);
  const myReviews = deduplicateReviews(myReviewsData?.pages);

  // Combine community reviews with personal reviews, deduplicating by ID
  const allReviews = useMemo(() => {
    const map = new Map<string, (typeof communityReviews)[0]>();
    for (const r of communityReviews) {
      map.set(r.id, r);
    }
    for (const r of myReviews) {
      if (!map.has(r.id) && r.status === 'visible') {
        map.set(r.id, r);
      }
    }
    return Array.from(map.values());
  }, [communityReviews, myReviews]);

  const isLoading = isLoadingCommunity && isLoadingMyReviews;
  const isRefetching = isRefetchingCommunity || isRefetchingMyReviews;
  const refetch = () => {
    void refetchCommunity();
    void refetchMyReviews();
  };
  // Client-side search filtering by product name, brand, or review body
  const filteredReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allReviews;
    return allReviews.filter((r) => {
      const name = (r.product?.name ?? '').toLowerCase();
      const brand = (r.product?.brand ?? '').toLowerCase();
      const body = (r.body ?? '').toLowerCase();
      return name.includes(q) || brand.includes(q) || body.includes(q);
    });
  }, [allReviews, searchQuery]);

  // Group all user reviews of the same product into an average star score with 1-3 review comments
  const productGroups: ProductCommunityGroup[] = useMemo(() => {
    const map = new Map<string, typeof filteredReviews>();
    for (const r of filteredReviews) {
      const list = map.get(r.productId) ?? [];
      list.push(r);
      map.set(r.productId, list);
    }

    const groups: ProductCommunityGroup[] = [];
    for (const [productId, productReviews] of map.entries()) {
      const firstProduct = productReviews.find((r) => r.product)?.product;
      const sortedReviews = [...productReviews].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      let sum = 0;
      let buyAgainCount = 0;
      for (const r of sortedReviews) {
        if (r.rating === 'buy_again') {
          sum += 5;
          buyAgainCount++;
        } else if (r.rating === 'buy_again_on_sale') {
          sum += 3;
          buyAgainCount++;
        } else if (r.rating === 'wont_buy') {
          sum += 1;
        }
      }
      const avg = sortedReviews.length > 0 ? sum / sortedReviews.length : 0;
      const recPct =
        sortedReviews.length > 0
          ? Math.round((buyAgainCount / sortedReviews.length) * 100)
          : null;

      groups.push({
        productId,
        product: firstProduct,
        reviews: sortedReviews,
        totalReviews: sortedReviews.length,
        averageScore: avg,
        recommendPercent: recPct,
        latestCreatedAt: sortedReviews[0]?.createdAt ?? new Date().toISOString(),
      });
    }

    // Sort product groups
    if (sort === 'score') {
      groups.sort((a, b) => b.averageScore - a.averageScore || b.totalReviews - a.totalReviews);
    } else {
      groups.sort(
        (a, b) =>
          new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime(),
      );
    }

    return groups;
  }, [filteredReviews, sort]);

  function handleVoteHelpful(reviewId: string, currentVote: 'helpful' | 'not_helpful' | null) {
    voteMutation.mutate({ reviewId, currentVote });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Sort Filter Bar */}
      <View
        style={[
          styles.sortBar,
          { borderBottomColor: theme.colors.border },
        ]}
      >
        <View style={styles.titleGroup}>
          <Ionicons name="sparkles" size={15} color={theme.colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.sortTitle, { color: theme.colors.text }]}>
            Community Picks
          </Text>
        </View>

        <View style={styles.sortPills}>
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
      </View>

      {/* Main Grouped List */}
      <FlatList
        data={productGroups}
        keyExtractor={(item) => item.productId}
        renderItem={({ item }) => (
          <ProductCommunityCard
            group={item}
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
        ListEmptyComponent={
          isLoading ? (
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
              <View
                style={[
                  styles.emptyIconCircle,
                  { backgroundColor: theme.colors.bgGlass },
                ]}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={32}
                  color={theme.colors.primaryDark}
                />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {searchQuery.trim()
                  ? 'No matching reviews'
                  : 'No community reviews yet'}
              </Text>
              <Text
                style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}
              >
                {searchQuery.trim()
                  ? `No reviews found for "${searchQuery}". Try a different product or brand name.`
                  : 'Reviews and tasting notes from community members will appear here.'}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sortBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sortTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sortPills: {
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
    minHeight: 36,
    justifyContent: 'center',
  },
  sortPillText: {
    fontSize: 12,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
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
    marginTop: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
