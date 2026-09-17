// apps/mobile/src/features/deals/DealFeed.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Deal, DealSort } from '@expyrico/shared';
import type { DealFeedFilters } from '../../api/deals';
import { useDealFeed } from '../../api/deals';
import { DealCard } from './DealCard';
import { DealSearchBar } from './DealSearchBar';
import { DealFilterModal } from './DealFilterModal';
import { EmptyState } from '../../components/EmptyState';
import { HamburgerButton } from '../../components/HamburgerButton';
import { BackToTopButton, useBackToTop } from '../../components/BackToTopButton';
import { useTheme } from '../../theme/useTheme';
import { useDealFeedStore } from '../../store/dealFeedStore';
import { retryIfServerUnavailable } from '../../store/connectionStore';

const SORTS: { id: DealSort; label: string; icon: string }[] = [
  { id: 'score', label: 'Top', icon: '🔥' },
  { id: 'new', label: 'Newest', icon: '⏱️' },
  { id: 'price_asc', label: 'Lowest Price', icon: '🏷️' },
  { id: 'expiry_asc', label: 'Expiring Soon', icon: '⏳' },
];

interface Props {
  currentUserId: string | null;
  onOpen: (deal: Deal) => void;
  onReport: (deal: Deal) => void;
  onNew: () => void;
}

export function DealFeed({ currentUserId, onOpen, onReport, onNew }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState<DealSort>('score');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<DealFeedFilters>({
    sort: 'score',
  });
  const flatListRef = useRef<FlatList<Deal>>(null);

  const {
    visible: showBackToTop,
    handleScroll,
    scrollToTop: handleScrollToTop,
    onTouchStart: handleTouchActivity,
  } = useBackToTop({
    scrollRef: flatListRef,
    hasTabBar: true,
    threshold: 280,
    autoHideTimeout: 2500,
  });

  // Calculate active filter count (excluding default sort)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.store) count++;
    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) count++;
    if (filters.expiryStatus && filters.expiryStatus !== 'all') count++;
    if (filters.country === 'ALL') count++;
    return count;
  }, [filters]);

  // Combined filters for API query
  const combinedFilters: DealFeedFilters = useMemo(
    () => ({
      ...filters,
      sort: selectedSort,
      q: searchQuery.trim() || undefined,
    }),
    [filters, selectedSort, searchQuery],
  );

  const q = useDealFeed(combinedFilters);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const refetch = q.refetch;
  const setHasItems = useDealFeedStore((s) => s.setHasItems);
  useEffect(() => {
    if (!q.isLoading && !q.isPending) {
      setHasItems(items.length > 0);
    }
  }, [items.length, q.isLoading, q.isPending, setHasItems]);

  useEffect(() => {
    return () => {
      setHasItems(true);
    };
  }, [setHasItems]);


  useFocusEffect(
    useCallback(() => {
      retryIfServerUnavailable();
      void refetch();
    }, [refetch]),
  );
  const isFiltered = Boolean(
    searchQuery.trim() ||
      filters.store ||
      filters.minPrice !== undefined ||
      filters.maxPrice !== undefined ||
      (filters.expiryStatus && filters.expiryStatus !== 'all') ||
      filters.country === 'ALL',
  );

  function clearAllFilters() {
    setSearchQuery('');
    setFilters({ sort: selectedSort });
  }

  function removeFilter(key: keyof DealFeedFilters) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Top Header */}
      <View style={[styles.headerRow, { paddingTop: Math.max(insets.top, 16) + 8, flexDirection: 'row', alignItems: 'center' }]}>
        <HamburgerButton testID="deals-hamburger-button" style={{ marginRight: 10 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, { color: theme.colors.text }]}>Deals</Text>
          <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
            Local grocery markdowns & clearance
          </Text>
        </View>
      </View>

      {/* Search Bar + Filter Button */}
      <DealSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onOpenFilter={() => setFilterModalVisible(true)}
        activeFilterCount={activeFilterCount}
      />

      {/* Sort Pills ScrollView */}
      <View style={styles.sortContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortList}
        >
          {SORTS.map((s) => {
            const selected = s.id === selectedSort;
            return (
              <Pressable
                key={s.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedSort(s.id)}
                style={[
                  styles.sortPill,
                  {
                    backgroundColor: selected ? theme.colors.primary : theme.colors.bgElevated,
                    borderColor: selected ? theme.colors.primary : theme.colors.border,
                    borderRadius: theme.radii.pill,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.sortText,
                    {
                      color: selected ? theme.colors.primaryFg : theme.colors.text,
                      fontWeight: selected ? '700' : '500',
                    },
                  ]}
                >
                  {s.icon} {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Active Filter Chips Bar */}
      {isFiltered && (
        <View style={styles.activeFiltersRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeChipsList}
          >
            {searchQuery.trim() ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSearchQuery('')}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  "{searchQuery}" ✕
                </Text>
              </Pressable>
            ) : null}

            {filters.store ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => removeFilter('store')}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  🏪 {filters.store} ✕
                </Text>
              </Pressable>
            ) : null}

            {filters.minPrice !== undefined || filters.maxPrice !== undefined ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setFilters((prev) => ({
                    ...prev,
                    minPrice: undefined,
                    maxPrice: undefined,
                  }));
                }}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  💲 {filters.minPrice !== undefined ? `$${filters.minPrice}` : '$0'} –{' '}
                  {filters.maxPrice !== undefined ? `$${filters.maxPrice}` : '∞'} ✕
                </Text>
              </Pressable>
            ) : null}

            {filters.expiryStatus === 'expiring_soon' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => removeFilter('expiryStatus')}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  ⏳ Expiring Soon ✕
                </Text>
              </Pressable>
            ) : filters.expiryStatus === 'unexpired' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => removeFilter('expiryStatus')}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  ✅ Unexpired ✕
                </Text>
              </Pressable>
            ) : null}

            {filters.country === 'ALL' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => removeFilter('country')}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  🌍 Worldwide ✕
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              accessibilityRole="button"
              onPress={clearAllFilters}
              style={[
                styles.clearAllBtn,
                { backgroundColor: theme.colors.primary + '18' },
              ]}
            >
              <Text style={[styles.clearAllText, { color: theme.colors.primaryDark }]}>
                Clear all
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* Main Deals Feed List */}
      <FlatList
        ref={flatListRef}
        onTouchStart={handleTouchActivity}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        data={items}
        keyExtractor={(d: Deal) => d.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 84 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => {
              retryIfServerUnavailable();
              void q.refetch();
            }}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <DealCard
            deal={item}
            onReport={onReport}
            onPress={onOpen}
            isOwn={item.userId === currentUserId}
          />
        )}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) {
            q.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          q.isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : isFiltered ? (
            <View style={{ marginTop: 24 }}>
              <EmptyState
                icon="search"
                title="No matching deals"
                body="Try adjusting your filters or search terms."
              />
              <Pressable
                accessibilityRole="button"
                onPress={clearAllFilters}
                style={[
                  styles.emptyStateAction,
                  { backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill },
                ]}
              >
                <Text style={[styles.emptyStateActionText, { color: theme.colors.primaryFg }]}>
                  Clear filters
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
              <EmptyState
                icon="pricetag"
                title="No deals posted yet"
                body="Be the first to share a grocery price drop in your area and help neighbors save!"
              />
              <Pressable
                testID="deal-create-empty-action"
                accessibilityRole="button"
                accessibilityLabel="Post a deal"
                onPress={onNew}
                style={({ pressed }) => [
                  styles.emptyStateAction,
                  {
                    backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
                    borderRadius: theme.radii.pill,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  },
                ]}
              >
                <Ionicons name="pricetag-outline" size={18} color="#FFFFFF" />
                <Text style={[styles.emptyStateActionText, { color: '#FFFFFF' }]}>
                  Post a deal
                </Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          q.isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator color={theme.colors.primary} />
            </View>
          ) : null
        }
      />

      <BackToTopButton
        scrollRef={flatListRef}
        visible={showBackToTop}
        onPress={handleScrollToTop}
        hasTabBar={true}
        testID="deals-back-to-top"
      />

      {/* Filter Modal Sheet */}
      <DealFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        onApply={(nextFilters) => setFilters(nextFilters)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 6,
  },
  heading: {
    fontSize: 26,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 13,
    marginTop: 2,
  },
  sortContainer: {
    paddingVertical: 6,
  },
  sortList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  sortPill: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortText: {
    fontSize: 13,
  },
  activeFiltersRow: {
    paddingVertical: 4,
  },
  activeChipsList: {
    paddingHorizontal: 20,
    gap: 8,
    alignItems: 'center',
  },
  activeChip: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 84,
    paddingTop: 6,
  },
  loadingContainer: {
    paddingVertical: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyStateAction: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateActionText: {
    fontWeight: '700',
    fontSize: 14,
  },
});
