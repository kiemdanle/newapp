import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';
import { useUserContributionsInfinite } from '../../../src/api/contributions';
import { ContributedProductCard } from '../../../src/features/gamification/ContributedProductCard';
import { ContributorBadgeIcon } from '../../../src/features/gamification/ContributorBadgeIcon';

type FilterTab = 'all' | 'active' | 'pending' | 'changes_required';

export default function CommunityContributionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    isRefetching,
    isError,
    fetchNextPage,
    hasNextPage,
    refetch,
  } = useUserContributionsInfinite({
    status: activeFilter,
    q: debouncedQuery,
    limit: 20,
  });

  const items = useMemo(() => {
    const raw = data?.pages.flatMap((page) => page.items) ?? [];
    let list = raw;
    if (activeFilter === 'active') {
      list = list.filter((i) => i.status === 'active');
    } else if (activeFilter === 'pending') {
      list = list.filter((i) => i.status === 'pending');
    } else if (activeFilter === 'changes_required') {
      list = list.filter((i) => i.status === 'changes_required');
    }
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.barcode && i.barcode.includes(q)) ||
          (i.brand && i.brand.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [data, activeFilter, searchQuery]);

  const firstPage = data?.pages[0];
  const stats = firstPage?.stats ?? {
    totalContributed: 0,
    activeApproved: 0,
    pendingReview: 0,
    changesRequested: 0,
    editsApproved: 0,
  };

  const progression = firstPage?.progression;
  const enabled = firstPage?.enabled ?? true;

  return (
    <Screen style={styles.screen}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={[styles.backButton, { backgroundColor: theme.colors.bgGlass }]}
          hitSlop={8}
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color={theme.colors.text} />
        </Pressable>
        <View style={styles.headerTitles}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            Community Contributions
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}>
            Products and packaging photos you've added to the public catalog
          </Text>
        </View>
      </View>

      {/* Summary Bento Banner */}
      {enabled && progression ? (
        <View
          style={[
            styles.bentoBanner,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <View style={styles.bentoHeader}>
            <ContributorBadgeIcon
              badgeKey={progression.badgeKey}
              colorToken={progression.colorToken}
              size={36}
            />
            <View style={styles.bentoHeaderText}>
              <Text style={[styles.bentoLevelTitle, { color: theme.colors.text }]}>
                {progression.currentLevel === 0
                  ? 'New Explorer'
                  : `Level ${progression.currentLevel} • ${progression.title}`}
              </Text>
              <Text style={[styles.bentoPointsSub, { color: theme.colors.primary }]}>
                {progression.totalPoints} contributor points earned
              </Text>
            </View>
          </View>

          {/* 3 Metric Pills */}
          <View style={[styles.metricsRow, { borderTopColor: theme.colors.border }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: theme.colors.text }]}>
                {stats.totalContributed}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
                Total Added
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: '#4BAE8A' }]}>
                {stats.activeApproved}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
                Approved
              </Text>
            </View>
            <View style={[styles.metricDivider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: '#F5A623' }]}>
                {stats.pendingReview}
              </Text>
              <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>
                In Review
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.colors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search your contributions..."
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.searchInput, { color: theme.colors.text }]}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {/* Filter Segmented Chips */}
      <View style={styles.filterChipsRow}>
        <Pressable
          onPress={() => setActiveFilter('all')}
          style={[
            styles.filterChip,
            activeFilter === 'all'
              ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              : { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: activeFilter === 'all' ? '#FFFFFF' : theme.colors.text },
            ]}
          >
            All ({stats.totalContributed})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveFilter('active')}
          style={[
            styles.filterChip,
            activeFilter === 'active'
              ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              : { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: activeFilter === 'active' ? '#FFFFFF' : theme.colors.text },
            ]}
          >
            Approved ({stats.activeApproved})
          </Text>
        </Pressable>

        <Pressable
          onPress={() => setActiveFilter('pending')}
          style={[
            styles.filterChip,
            activeFilter === 'pending'
              ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }
              : { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          <Text
            style={[
              styles.filterChipText,
              { color: activeFilter === 'pending' ? '#FFFFFF' : theme.colors.text },
            ]}
          >
            In Review ({stats.pendingReview})
          </Text>
        </Pressable>

        {stats.changesRequested > 0 && (
          <Pressable
            onPress={() => setActiveFilter('changes_required')}
            style={[
              styles.filterChip,
              activeFilter === 'changes_required'
                ? { backgroundColor: '#E0442A', borderColor: '#E0442A' }
                : { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                { color: activeFilter === 'changes_required' ? '#FFFFFF' : theme.colors.text },
              ]}
            >
              Changes ({stats.changesRequested})
            </Text>
          </Pressable>
        )}
      </View>

      {/* Contributions List */}
      {isError ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.colors.danger} />
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Unable to load contributions</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
            Check your network connection and try again.
          </Text>
          <Pressable
            onPress={() => void refetch()}
            style={[styles.emptyActionButton, { backgroundColor: theme.colors.primary }]}
          >
            <Ionicons name="refresh-outline" size={18} color="#FFFFFF" />
            <Text style={styles.emptyActionText}>Retry</Text>
          </Pressable>
        </View>
      ) : isLoading && !data ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={Boolean(isRefetching && !isFetchingNextPage)}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <ContributedProductCard
              item={item}
              onPress={() => {
                if (item.status === 'active') {
                  navigation.push('Product', { id: item.id });
                } else if (item.status === 'pending') {
                  navigation.push('ProductNew', { productId: item.id, resume: 'pending' });
                } else if (item.status === 'changes_required') {
                  navigation.push('ProductNew', { productId: item.id, resume: 'edit' });
                }
              }}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="sparkles-outline" size={48} color={theme.colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                {searchQuery ? 'No matching contributions' : 'No contributions yet'}
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                {searchQuery
                  ? 'Try searching by a different product name or barcode.'
                  : 'Add a new product or upload photos to earn your Level 1 Novice Scout badge!'}
              </Text>
              {!searchQuery && (
                <Pressable
                  onPress={() => navigation.push('Scan')}
                  style={[styles.emptyActionButton, { backgroundColor: '#F5A623' }]}
                >
                  <Ionicons name="scan-outline" size={18} color="#2C2C28" />
                  <Text style={[styles.emptyActionText, { color: '#2C2C28' }]}>Scan or Add Product</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  bentoBanner: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  bentoHeaderText: {
    flex: 1,
  },
  bentoLevelTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bentoPointsSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingVertical: 10,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 1,
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  filterChipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginTop: 10,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16,
  },
  emptyActionText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
