// apps/mobile/src/features/giveaways/GiveawayFeed.tsx
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Giveaway, GiveawaySort } from '@expyrico/shared';
import type { GiveawayFeedFilters } from '../../api/giveaways';
import { useGiveawayFeed, useUpdateGiveaway, useCancelGiveaway } from '../../api/giveaways';
import { GiveawayCard } from './GiveawayCard';
import { GiveawaySearchBar } from './GiveawaySearchBar';
import { GiveawayFilterModal } from './GiveawayFilterModal';
import { GiveawayQuickEditModal } from './GiveawayQuickEditModal';
import { EmptyState } from '@/components/EmptyState';
import { useSessionStore } from '@/auth/session-store';
import { useTheme } from '@/theme/useTheme';
import type { AppNavigationProp } from '@/navigation/AppNavigator';

const SORTS: { id: GiveawaySort; label: string; icon: string }[] = [
  { id: 'new', label: 'Newest', icon: '⏱️' },
  { id: 'expiry_asc', label: 'Expiring Soon', icon: '⏳' },
  { id: 'claims_asc', label: 'Fewest Claims', icon: '🎁' },
  { id: 'claims_desc', label: 'Popular', icon: '🔥' },
  { id: 'old', label: 'Oldest', icon: '📜' },
];

interface Props {
  onOpen: (id: string) => void;
  onNew: () => void;
}

export function GiveawayFeed({ onOpen, onNew }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AppNavigationProp>();
  const currentUserId = useSessionStore((s) => s.user?.id ?? null);
  const fabBottom = 84 + Math.max(insets.bottom, 0);

  const updateGiveaway = useUpdateGiveaway();
  const cancelGiveaway = useCancelGiveaway();
  const [editingGiveaway, setEditingGiveaway] = useState<Giveaway | null>(null);
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState<GiveawaySort>('new');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [filters, setFilters] = useState<GiveawayFeedFilters>({
    status: 'open',
    sort: 'new',
  });

  // Calculate active filter count (excluding default open status & new sort)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.status && filters.status !== 'open') count++;
    if (filters.location) count++;
    if (filters.hasPhoto) count++;
    if (filters.country === 'ALL') count++;
    return count;
  }, [filters]);

  // Combined filters for API query
  const combinedFilters: GiveawayFeedFilters = useMemo(
    () => ({
      ...filters,
      sort: selectedSort,
      q: searchQuery.trim() || undefined,
    }),
    [filters, selectedSort, searchQuery],
  );

  const q = useGiveawayFeed(combinedFilters);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const refetch = q.refetch;

  // Auto-refetch when user navigates back to the Giveaways tab
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  if (q.error) {
    // eslint-disable-next-line no-console
    console.warn('[GiveawayFeed] query error:', q.error);
  }
  const isFiltered = Boolean(
    searchQuery.trim() ||
      (filters.status && filters.status !== 'open') ||
      filters.location ||
      filters.hasPhoto ||
      filters.country === 'ALL',
  );

  function clearAllFilters() {
    setSearchQuery('');
    setFilters({ status: 'open', sort: selectedSort });
  }

  function removeFilter(key: keyof GiveawayFeedFilters) {
    setFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  const handleEdit = useCallback((giveaway: Giveaway) => {
    setEditingGiveaway(giveaway);
  }, []);

  const handleSaveEdit = useCallback(
    async (patch: {
      title: string;
      locationText: string;
      description?: string;
      photoUrl?: string | null;
      photoUrls?: string[];
    }) => {
      if (!editingGiveaway) return;
      await updateGiveaway.mutateAsync({
        id: editingGiveaway.id,
        patch,
      });
    },
    [editingGiveaway, updateGiveaway],
  );

  const handleDelete = useCallback(
    (giveaway: Giveaway) => {
      Alert.alert(
        'Cancel Giveaway',
        `Are you sure you want to cancel "${giveaway.title}"? It will be closed and removed from active listings.`,
        [
          { text: 'Keep item', style: 'cancel' },
          {
            text: 'Cancel Giveaway',
            style: 'destructive',
            onPress: () => {
              void cancelGiveaway.mutateAsync(giveaway.id);
            },
          },
        ],
      );
    },
    [cancelGiveaway],
  );

  const handleManage = useCallback(
    (giveaway: Giveaway) => {
      navigation.push('GiveawayManage', { id: giveaway.id });
    },
    [navigation],
  );

  const handleShare = useCallback((giveaway: Giveaway) => {
    void Share.share({
      message: `Check out this giveaway on Expyrico: ${giveaway.title} in ${giveaway.locationText}`,
      title: giveaway.title,
    });
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      {/* Top Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.heading, { color: theme.colors.text }]}>Giveaways</Text>
        <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
          Offer food or groceries to neighbors before they expire.
        </Text>
      </View>

      {/* Search Bar + Filter Button */}
      <GiveawaySearchBar
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

            {filters.status && filters.status !== 'open' ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => removeFilter('status')}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  🏷️ Status: {filters.status} ✕
                </Text>
              </Pressable>
            ) : null}

            {filters.location ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => removeFilter('location')}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  📍 {filters.location} ✕
                </Text>
              </Pressable>
            ) : null}

            {filters.hasPhoto ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => removeFilter('hasPhoto')}
                style={[
                  styles.activeChip,
                  { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.activeChipText, { color: theme.colors.text }]}>
                  📷 Has Photo ✕
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

      {/* Main Giveaways Feed List */}
      <FlatList
        data={items}
        keyExtractor={(d: Giveaway) => d.id}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 150 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => q.refetch()}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <GiveawayCard
            giveaway={item}
            currentUserId={currentUserId}
            onPress={() => onOpen(item.id)}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onManage={handleManage}
            onShare={handleShare}
          />
        )}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) {
            q.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          q.isLoading || q.isPending ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : q.isError ? (
            <View style={{ marginTop: 24, paddingHorizontal: 20 }}>
              <EmptyState
                icon="alert-circle"
                title="Could not load giveaways"
                body={(q.error as Error)?.message || 'Please check your connection and try again.'}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetch()}
                style={[
                  styles.emptyStateAction,
                  { backgroundColor: theme.colors.primary, borderRadius: theme.radii.pill },
                ]}
              >
                <Text style={[styles.emptyStateActionText, { color: theme.colors.primaryFg }]}>
                  Retry
                </Text>
              </Pressable>
            </View>
          ) : isFiltered ? (
            <View style={{ marginTop: 24 }}>
              <EmptyState
                icon="search"
                title="No matching giveaways"
                body="Try adjusting your filters or search keywords."
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
            <View style={{ marginTop: 24 }}>
              <EmptyState
                icon="gift"
                title="No giveaways yet"
                body="Be the first to share food or groceries with neighbors nearby!"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Share the first item"
                onPress={onNew}
                style={({ pressed }) => [
                  styles.emptyStateAction,
                  {
                    backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
                    borderRadius: theme.radii.pill,
                  },
                ]}
              >
                <Text style={[styles.emptyStateActionText, { color: theme.colors.primaryFg }]}>
                  + Share the first item
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

      {/* Floating Action Button (FAB) positioned cleanly above floating tab bar */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Share item"
        onPress={onNew}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: fabBottom,
            backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
            shadowColor: '#000',
          },
        ]}
      >
        <Ionicons name="add" size={22} color={theme.colors.primaryFg} style={{ marginRight: 4 }} />
        <Text style={[styles.fabText, { color: theme.colors.primaryFg }]}>Share Item</Text>
      </Pressable>

      {/* Filter Modal Sheet */}
      <GiveawayFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        onApply={(nextFilters) => setFilters(nextFilters)}
      />

      {/* Quick Edit Giveaway Modal */}
      <GiveawayQuickEditModal
        visible={Boolean(editingGiveaway)}
        giveaway={editingGiveaway}
        onClose={() => setEditingGiveaway(null)}
        onSave={handleSaveEdit}
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
    paddingTop: 18,
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
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 28,
    minHeight: 50,
    elevation: 6,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
  },
  fabText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
