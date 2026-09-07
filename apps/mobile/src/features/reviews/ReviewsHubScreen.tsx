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
} from 'react-native';
import type { Review } from '@expyrico/shared';
import { useRoute, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Screen } from '../../components/Screen';
import { useMyReviews, deduplicateReviews } from '../../api/reviews';
import { MyReviewCard } from './MyReviewCard';
import { CommunityReviewsFeed } from './CommunityReviewsFeed';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { useTheme } from '../../theme/useTheme';
import type { AppNavigationProp } from '../../navigation/AppNavigator';

export function ReviewsHubScreen() {
  const theme = useTheme();
  const route = useRoute();
  const navigation = useNavigation<AppNavigationProp>();
  const params = (route.params as { initialTab?: 'mine' | 'community' } | undefined) ?? {};

  const [activeTab, setActiveTab] = useState<'community' | 'mine'>(
    params.initialTab ?? 'community',
  );
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data: myReviewsData,
    isLoading: isLoadingMyReviews,
    isRefetching: isRefetchingMyReviews,
    refetch: refetchMyReviews,
    hasNextPage: hasNextMyPage,
    fetchNextPage: fetchNextMyPage,
    isFetchingNextPage: isFetchingNextMyPage,
  } = useMyReviews({ limit: 15 });

  const allMyReviews = deduplicateReviews(myReviewsData?.pages);

  // Client-side search filtering for My Reviews
  const myReviews = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allMyReviews;
    return allMyReviews.filter((r) => {
      const name = (r.product?.name ?? '').toLowerCase();
      const brand = (r.product?.brand ?? '').toLowerCase();
      const body = (r.body ?? '').toLowerCase();
      return name.includes(q) || brand.includes(q) || body.includes(q);
    });
  }, [allMyReviews, searchQuery]);

  function handleEditReview(productId: string, review?: Review) {
    (navigation as any).navigate('ProductReview', { id: productId, review });
  }

  function handleViewProduct(productId: string) {
    (navigation as any).navigate('Product', { id: productId });
  }

  function handleScanProduct() {
    (navigation as any).navigate('Scan');
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.bg }]}>
      <Screen style={styles.screen} padded={false}>
        {/* Top Header Row with Logo & Quick Stat Badge */}
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Logo size={28} />
            <View style={styles.headerTextGroup}>
              <Text
                style={[styles.headerTitle, { color: theme.colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Reviews & Recommendations
              </Text>
              <Text
                style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                Your trusted notes & picks.
              </Text>
            </View>
          </View>

          {allMyReviews.length > 0 ? (
            <View
              style={[
                styles.statPill,
                {
                  backgroundColor: theme.colors.bgGlass,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Ionicons name="star" size={13} color="#F5A623" style={{ marginRight: 4 }} />
              <Text style={[styles.statPillText, { color: theme.colors.primaryDark }]}>
                {allMyReviews.length} rated
              </Text>
            </View>
          ) : null}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
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
              placeholder="Search products, brands, or notes..."
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
                accessibilityLabel="Clear search text"
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

        {/* Segmented Switcher */}
        <View
          style={[
            styles.segmentedContainer,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="Community Picks"
            accessibilityState={{ selected: activeTab === 'community' }}
            onPress={() => setActiveTab('community')}
            style={[
              styles.segmentButton,
              activeTab === 'community' && [
                styles.segmentButtonActive,
                { backgroundColor: theme.colors.bg },
              ],
            ]}
          >
            <Ionicons
              name="earth-outline"
              size={15}
              color={
                activeTab === 'community'
                  ? theme.colors.primaryDark
                  : theme.colors.textMuted
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === 'community'
                      ? theme.colors.primaryDark
                      : theme.colors.textMuted,
                  fontWeight: activeTab === 'community' ? '700' : '500',
                },
              ]}
            >
              Community
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="tab"
            accessibilityLabel="My Reviews"
            accessibilityState={{ selected: activeTab === 'mine' }}
            onPress={() => setActiveTab('mine')}
            style={[
              styles.segmentButton,
              activeTab === 'mine' && [
                styles.segmentButtonActive,
                { backgroundColor: theme.colors.bg },
              ],
            ]}
          >
            <Ionicons
              name="person-outline"
              size={15}
              color={
                activeTab === 'mine'
                  ? theme.colors.primaryDark
                  : theme.colors.textMuted
              }
              style={{ marginRight: 6 }}
            />
            <Text
              style={[
                styles.segmentText,
                {
                  color:
                    activeTab === 'mine'
                      ? theme.colors.primaryDark
                      : theme.colors.textMuted,
                  fontWeight: activeTab === 'mine' ? '700' : '500',
                },
              ]}
            >
              My Reviews
            </Text>
            {allMyReviews.length > 0 ? (
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor:
                      activeTab === 'mine'
                        ? theme.colors.primaryLight
                        : theme.colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countBadgeText,
                    {
                      color:
                        activeTab === 'mine'
                          ? theme.colors.primaryDark
                          : theme.colors.textMuted,
                    },
                  ]}
                >
                  {allMyReviews.length}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {/* Tab Content */}
        {activeTab === 'community' ? (
          <CommunityReviewsFeed searchQuery={searchQuery} />
        ) : (
          <FlatList
            data={myReviews}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MyReviewCard
                review={item}
                onEdit={handleEditReview}
                onViewProduct={handleViewProduct}
              />
            )}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={isRefetchingMyReviews}
                onRefresh={refetchMyReviews}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
            onEndReached={() => {
              if (hasNextMyPage && !isFetchingNextMyPage) {
                void fetchNextMyPage();
              }
            }}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={
              isLoadingMyReviews ? (
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
                      name="star-outline"
                      size={32}
                      color={theme.colors.primaryDark}
                    />
                  </View>
                  <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                    {searchQuery.trim()
                      ? 'No matching reviews'
                      : 'No reviews yet'}
                  </Text>
                  <Text
                    style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}
                  >
                    {searchQuery.trim()
                      ? `No personal reviews found for "${searchQuery}". Try a different keyword.`
                      : 'Share your thoughts on products you have used to help others and remember what you loved.'}
                  </Text>
                  {!searchQuery.trim() ? (
                    <View style={{ marginTop: 18, width: '100%' }}>
                      <Button
                        label="Scan a product to review"
                        variant="primary"
                        icon="camera-outline"
                        onPress={handleScanProduct}
                      />
                    </View>
                  ) : null}
                </View>
              )
            }
            ListFooterComponent={
              isFetchingNextMyPage ? (
                <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
              ) : null
            }
          />
        )}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  headerTextGroup: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
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
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    padding: 4,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 9,
  },
  segmentButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80, // Space for bottom floating bar
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
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
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ReviewsHubScreen;
