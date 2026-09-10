import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import { useTheme } from '../../../src/theme/useTheme';
import { useUserContributionsInfinite } from '../../../src/api/contributions';
import { ContributedProductCard } from '../../../src/features/gamification/ContributedProductCard';
import { ContributorBadgeIcon } from '../../../src/features/gamification/ContributorBadgeIcon';
import { DraftsSearchBar } from '../../../src/features/products/DraftsSearchBar';
import {
  DraftsSortPills,
  type DraftSortOption,
} from '../../../src/features/products/DraftsSortPills';

type FilterTab = 'all' | 'active' | 'pending' | 'changes_required';

export default function CommunityContributionsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [selectedSort, setSelectedSort] = useState<DraftSortOption>('newest');
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

  const items = useMemo(() => {
    const raw = data?.pages.flatMap((page) => page.items) ?? [];
    let list = [...raw];

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

    if (selectedSort === 'newest') {
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (selectedSort === 'oldest') {
      list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (selectedSort === 'name_asc') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (selectedSort === 'name_desc') {
      list.sort((a, b) => b.name.localeCompare(a.name));
    }

    return list;
  }, [data, activeFilter, searchQuery, selectedSort]);

  const tabs: { id: FilterTab; label: string }[] = [
    { id: 'all', label: `All (${stats.totalContributed})` },
    { id: 'active', label: `Approved (${stats.activeApproved})` },
    { id: 'pending', label: `In Review (${stats.pendingReview})` },
  ];
  if (stats.changesRequested > 0) {
    tabs.push({ id: 'changes_required', label: `Changes (${stats.changesRequested})` });
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* In-Page Header Section */}
      <View style={styles.header}>
        <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700' }}>
          Community Contributions
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
          Products and packaging photos you've added to the public catalog
        </Text>
      </View>

      {/* Contributor Progression Overview Card */}
      {enabled && progression ? (
        <View
          style={[
            styles.overviewCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <View style={styles.overviewTopRow}>
            <ContributorBadgeIcon
              badgeKey={progression.badgeKey}
              colorToken={progression.colorToken}
              size={40}
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={[styles.levelTitleText, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                {progression.currentLevel === 0
                  ? 'Level 0 • New Explorer'
                  : `Level ${progression.currentLevel} • ${progression.title}`}
              </Text>
              <Text style={[styles.pointsSubText, { color: theme.colors.primary }]}>
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
              <Text style={[styles.metricValue, { color: '#3A8F6F' }]}>
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

      {/* Search Bar matching Product Templates */}
      <DraftsSearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search your contributions..."
      />

      {/* Sort Pills matching Product Templates */}
      <DraftsSortPills
        selectedSort={selectedSort}
        onSelectSort={setSelectedSort}
      />

      {/* Filter Tabs Bar matching Product Templates */}
      <View style={styles.tabBar} accessibilityRole="tablist">
        {tabs.map((tab) => {
          const isActive = activeFilter === tab.id;
          return (
            <Pressable
              key={tab.id}
              testID={`contributions-tab-${tab.id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Filter by ${tab.label}`}
              onPress={() => setActiveFilter(tab.id)}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.bgElevated,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.tabPillText,
                  {
                    color: isActive ? '#FFFFFF' : theme.colors.textMuted,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Main List / Error / Empty States */}
      {isError ? (
        <View style={styles.emptyContainer}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: theme.colors.bgElevated,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}
          >
            <Ionicons name="alert-circle-outline" size={32} color={theme.colors.danger} />
          </View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              Unable to load contributions
            </Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
              Check your network connection and try again.
            </Text>
          </View>
          <Pressable
            onPress={() => void refetch()}
            style={({ pressed }) => [
              styles.emptyActionButton,
              {
                backgroundColor: theme.colors.primary,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
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
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 36,
                  backgroundColor: theme.colors.bgElevated,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
              >
                <Ionicons name="sparkles-outline" size={32} color={theme.colors.primary} />
              </View>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  {searchQuery ? 'No matching contributions' : 'No contributions yet'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                  {searchQuery
                    ? 'Try searching by a different product name or barcode.'
                    : 'Add a new product or upload photos to earn your Level 1 Novice Scout badge!'}
                </Text>
              </View>
              {!searchQuery && (
                <Pressable
                  onPress={() => navigation.push('Scan')}
                  style={({ pressed }) => [
                    styles.emptyActionButton,
                    {
                      backgroundColor: theme.colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Ionicons name="scan-outline" size={18} color="#FFFFFF" />
                  <Text style={styles.emptyActionText}>Scan or Add Product</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}

      {/* Floating Bottom Action Dock matching pantry and drafts */}
      <View style={styles.bottomDockWrapper} pointerEvents="box-none">
        <Pressable
          testID="contributions-bottom-scan"
          accessibilityRole="button"
          accessibilityLabel="Scan to contribute product"
          onPress={() => navigation.push('Scan')}
          style={({ pressed }) => [
            styles.bottomDock,
            {
              backgroundColor: theme.colors.primary,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Ionicons name="barcode-outline" size={20} color="#FFFFFF" />
          <Text style={styles.bottomDockText}>Scan to contribute</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  overviewCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  overviewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelTitleText: {
    fontSize: 16,
    fontWeight: '700',
  },
  pointsSubText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  tabPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    borderWidth: 1,
  },
  tabPillText: {
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 140,
    gap: 10,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
  },
  emptyContainer: {
    paddingTop: 40,
    paddingHorizontal: 24,
    gap: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  emptyActionText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  bottomDockWrapper: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bottomDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomDockText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
