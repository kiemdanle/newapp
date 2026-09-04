import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelectionModeStore } from '../../store/selectionModeStore';
import type { AppNavigationProp } from '../../navigation/AppNavigator';
import {
  useActiveRecords,
  patchLocalRecord,
  deleteLocalRecord,
  type LocalRecord,
} from '../../api/records';
import { usePantryScope } from '../../store/pantryScope';
import { useMyHouseholds } from '../../api/households';
import { runSync } from '../../db/sync';
import { groupRecords, type GroupedRecords } from './groupRecords';
import { RecordCard } from './RecordCard';
import { QuickEditModal } from './QuickEditModal';
import { useTheme } from '../../theme/useTheme';
import { filterAndSortRecords } from './filterAndSortRecords';
import { usePantryPagination } from './usePantryPagination';
import { PantrySearchBar } from './PantrySearchBar';
import { PantrySortPills } from './PantrySortPills';
import { PantryActiveFilterChips } from './PantryActiveFilterChips';
import { PantryFilterModal } from './PantryFilterModal';
import type { PantryFilterState, PantrySortOption } from './pantryFilterTypes';
import { BulkScopeModal } from './BulkScopeModal';

const SECTION_TITLES: Record<keyof GroupedRecords, string> = {
  expired: 'Expired',
  today: 'Expires today',
  thisWeek: 'Use this week',
  later: 'Later',
};

interface RowProps {
  record: LocalRecord;
  householdName?: string | null;
  onPress: (id: string) => void;
  onAddQuantity: (record: LocalRecord) => void;
  onEdit: (record: LocalRecord) => void;
  onDelete: (record: LocalRecord) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPress?: (id: string) => void;
  onToggleSelect?: (id: string) => void;
}

const RecordRow = React.memo(function RecordRow({
  record,
  householdName,
  onPress,
  onAddQuantity,
  onEdit,
  onDelete,
  selectionMode,
  isSelected,
  onLongPress,
  onToggleSelect,
}: RowProps) {
  return (
    <RecordCard
      record={record}
      householdName={householdName}
      onPress={() => onPress(record.id)}
      onAddQuantity={onAddQuantity}
      onEdit={onEdit}
      onDelete={onDelete}
      selectionMode={selectionMode}
      isSelected={isSelected}
      onLongPress={onLongPress ? () => onLongPress(record.id) : undefined}
      onToggleSelect={onToggleSelect ? () => onToggleSelect(record.id) : undefined}
    />
  );
});

export interface RecordListProps {
  header?: React.ReactElement | ((isFiltered: boolean) => React.ReactElement);
  empty?: React.ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void | Promise<void>;
}

export function RecordList({
  header,
  empty,
  refreshing,
  onRefresh,
}: RecordListProps) {
  const insets = useSafeAreaInsets();
  const records = useActiveRecords();
  const { scope, householdId } = usePantryScope();
  const navigation = useNavigation<AppNavigationProp>();
  const theme = useTheme();
  const queryClient = useQueryClient();
  const setGlobalSelectionMode = useSelectionModeStore((s) => s.setSelectionMode);
  const { data: householdsData } = useMyHouseholds();
  const householdNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const h of householdsData?.items ?? []) {
      map[h.id] = h.name;
    }
    return map;
  }, [householdsData]);

  const [editingRecord, setEditingRecord] = useState<LocalRecord | null>(null);
  const [internalRefreshing, setInternalRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState<PantrySortOption>('expiry_asc');
  const [filters, setFilters] = useState<PantryFilterState>({
    expiryStatus: 'all',
  });
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkScopeModalVisible, setBulkScopeModalVisible] = useState(false);
  const previousScope = useRef({ scope, householdId });
  useEffect(() => {
    if (
      previousScope.current.scope !== scope ||
      previousScope.current.householdId !== householdId
    ) {
      previousScope.current = { scope, householdId };
      setFilters({ expiryStatus: 'all' });
      setSearchQuery('');
      setSelectionMode(false);
      setSelectedIds(new Set());
    }
  }, [scope, householdId]);

  useEffect(() => {
    setGlobalSelectionMode(selectionMode);
    return () => {
      setGlobalSelectionMode(false);
    };
  }, [selectionMode, setGlobalSelectionMode]);

  useEffect(() => {
    if (!selectionMode) return;
    const onBackPress = () => {
      setSelectionMode(false);
      setSelectedIds(new Set());
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [selectionMode]);

  const normalizedSearchQuery = searchQuery.trim();
  const isFiltered = Boolean(
    normalizedSearchQuery ||
      filters.category ||
      (filters.expiryStatus && filters.expiryStatus !== 'all') ||
      filters.inStockOnly ||
      filters.store ||
      (filters.householdScope && filters.householdScope !== 'all') ||
      selectedSort !== 'expiry_asc',
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.category) count++;
    if (filters.expiryStatus && filters.expiryStatus !== 'all') count++;
    if (filters.inStockOnly) count++;
    if (filters.store) count++;
    if (filters.householdScope && filters.householdScope !== 'all') count++;
    return count;
  }, [filters]);

  const resolvedHeader = typeof header === 'function' ? header(isFiltered) : header;
  const filteredRecords = useMemo(
    () =>
      filterAndSortRecords(
        records,
        {
          ...filters,
          query: normalizedSearchQuery || undefined,
        },
        selectedSort,
      ),
    [records, filters, normalizedSearchQuery, selectedSort],
  );

  const resetKey = [
    scope,
    householdId,
    normalizedSearchQuery,
    filters.category,
    filters.expiryStatus,
    filters.inStockOnly,
    filters.store,
    filters.householdScope,
    selectedSort,
  ].join(':');

  const {
    paginatedItems,
    hasMore,
    isLoadingMore,
    loadMore,
    totalCount,
  } = usePantryPagination(filteredRecords, 20, resetKey);

  const onEndReachedCalledDuringMomentumRef = useRef(true);
  const handleScrollBegin = useCallback(() => {
    onEndReachedCalledDuringMomentumRef.current = false;
  }, []);

  const handleEndReached = useCallback(() => {
    if (onEndReachedCalledDuringMomentumRef.current) return;
    onEndReachedCalledDuringMomentumRef.current = true;
    loadMore();
  }, [loadMore]);

  const groups = useMemo(() => groupRecords(paginatedItems), [paginatedItems]);
  const sections = useMemo(
    () =>
      (Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>)
        .filter((key) => groups[key].length > 0)
        .map((key) => ({ key, title: SECTION_TITLES[key], data: groups[key] })),
    [groups],
  );

  const openRecord = useCallback(
    (id: string) => navigation.navigate('Record', { id }),
    [navigation],
  );

  const handleDefaultRefresh = useCallback(async () => {
    setInternalRefreshing(true);
    try {
      await Promise.allSettled([
        runSync(),
        queryClient.invalidateQueries({ queryKey: ['households'] }),
        queryClient.invalidateQueries({ queryKey: ['records'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);
    } finally {
      setInternalRefreshing(false);
    }
  }, [queryClient]);

  const isRefreshing = refreshing ?? internalRefreshing;
  const handleRefresh = onRefresh ?? handleDefaultRefresh;
  const refreshControl = (
    <RefreshControl
      testID="pantry-refresh-control"
      refreshing={isRefreshing}
      onRefresh={handleRefresh}
      tintColor={theme.colors.primary}
      colors={[theme.colors.primary]}
      progressBackgroundColor={theme.colors.bgElevated}
    />
  );
  const listContentContainerStyle = {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xs,
    paddingBottom: 84,
    flexGrow: 1,
  };

  const handleAddQuantity = useCallback(
    (record: LocalRecord) =>
      patchLocalRecord(record.id, { quantity: record.quantity + 1 }),
    [],
  );

  const handleEdit = useCallback((record: LocalRecord) => {
    setEditingRecord(record);
  }, []);

  const handleDelete = useCallback((record: LocalRecord) => {
    const itemName = record.customName || 'this item';
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${itemName}"? It will be removed from your pantry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteLocalRecord(record.id);
          },
        },
      ],
    );
  }, []);

  const handleSaveEdit = useCallback(
    async (patch: {
      customName?: string | null;
      quantity: number;
      unit: string;
      expiryDate: string;
    }) => {
      if (!editingRecord) return;
      await patchLocalRecord(editingRecord.id, patch);
    },
    [editingRecord],
  );

  const handleLongPress = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handlePressItem = useCallback(
    (id: string) => {
      if (selectionMode) {
        handleToggleSelect(id);
      } else {
        openRecord(id);
      }
    },
    [selectionMode, handleToggleSelect, openRecord],
  );

  const allSelectableItems = useMemo(
    () => (isFiltered ? paginatedItems : records),
    [isFiltered, paginatedItems, records],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === allSelectableItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSelectableItems.map((r) => r.id)));
    }
  }, [selectedIds.size, allSelectableItems]);

  const handleCancelSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleMovedBulk = useCallback(
    (updatedCount: number, destinationName: string) => {
      setSelectionMode(false);
      setSelectedIds(new Set());
      Alert.alert(
        'Items Moved',
        `Moved ${updatedCount} ${updatedCount === 1 ? 'item' : 'items'} to ${destinationName}.`,
      );
    },
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: LocalRecord }) => (
      <RecordRow
        record={item}
        householdName={item.householdId ? householdNames[item.householdId] : undefined}
        onPress={handlePressItem}
        onAddQuantity={handleAddQuantity}
        onEdit={handleEdit}
        onDelete={handleDelete}
        selectionMode={selectionMode}
        isSelected={selectedIds.has(item.id)}
        onLongPress={handleLongPress}
        onToggleSelect={handleToggleSelect}
      />
    ),
    [
      handlePressItem,
      handleAddQuantity,
      handleEdit,
      handleDelete,
      householdNames,
      selectionMode,
      selectedIds,
      handleLongPress,
      handleToggleSelect,
    ],
  );
  const keyExtractor = useCallback((item: LocalRecord) => item.id, []);
  const handleClearAll = useCallback(() => {
    setSearchQuery('');
    setFilters({ expiryStatus: 'all' });
    setSelectedSort('expiry_asc');
  }, []);

  const renderPaginationFooter = () => {
    if (isLoadingMore) {
      return (
        <View testID="pantry-pagination-spinner" style={styles.footerContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.loadingFooterText, { color: theme.colors.textMuted }]}>
            Loading more items...
          </Text>
        </View>
      );
    }
    if (!hasMore && totalCount > 20) {
      return (
        <View style={styles.footerContainer}>
          <Text style={[styles.endFooterText, { color: theme.colors.textMuted }]}>
            All {totalCount} items loaded
          </Text>
        </View>
      );
    }
    return null;
  };

  // Common interactive controls: Search Bar, Sort Pills, Active Filter Chips
  const renderControls = () => (
    <View style={styles.controlsWrap}>
      <PantrySearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        onOpenFilter={() => setFilterModalVisible(true)}
        activeFilterCount={activeFilterCount}
      />
      <PantrySortPills selectedSort={selectedSort} onSelectSort={setSelectedSort} />
      {isFiltered ? (
        <PantryActiveFilterChips
          filters={filters}
          searchQuery={searchQuery}
          onRemoveFilter={(key) => setFilters((prev) => ({ ...prev, [key]: undefined }))}
          onClearSearch={() => setSearchQuery('')}
          onClearAll={() => {
            setSearchQuery('');
            setFilters({ expiryStatus: 'all' });
            setSelectedSort('expiry_asc');
          }}
        />
      ) : null}
    </View>
  );

  // Empty state when search or filters return 0 matches from an otherwise populated pantry
  const renderFilterEmptyState = () => (
    <View
      testID="pantry-filter-empty-card"
      style={[
        styles.emptyFilterCard,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
        },
      ]}
    >
      <View
        style={[
          styles.emptyFilterIconWrap,
          { backgroundColor: theme.colors.primaryLight, borderRadius: theme.radii.md },
        ]}
      >
        <Ionicons name="search-outline" size={28} color={theme.colors.primaryDark} />
      </View>
      <Text style={[styles.emptyFilterTitle, { color: theme.colors.text }]}>
        No matching pantry items
      </Text>
      <Text style={[styles.emptyFilterBody, { color: theme.colors.textMuted }]}>
        Try searching with different keywords or clearing active filters.
      </Text>
      <Pressable
        testID="pantry-clear-filters-cta"
        accessibilityRole="button"
        accessibilityLabel="Clear active filters"
        onPress={() => {
          setSearchQuery('');
          setFilters({ expiryStatus: 'all' });
          setSelectedSort('expiry_asc');
        }}
        style={[
          styles.clearFiltersBtn,
          { backgroundColor: theme.colors.accent, borderRadius: theme.radii.md },
        ]}
      >
        <Text style={[styles.clearFiltersBtnText, { color: theme.colors.text }]}>
          Clear active filters
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {!isFiltered ? (
        // DEFAULT UNFILTERED VIEW: Urgency SectionList + Header + Controls + Pagination
        <SectionList
          testID="pantry-record-list"
          sections={sections}
          scrollEnabled
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          stickySectionHeadersEnabled={false}
          ListHeaderComponent={
            <View style={styles.headerStack}>
              {resolvedHeader}
              {records.length > 0 ? renderControls() : null}
            </View>
          }
          ListEmptyComponent={empty}
          ListFooterComponent={renderPaginationFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.25}
          onScrollBeginDrag={handleScrollBegin}
          onMomentumScrollBegin={handleScrollBegin}
          refreshControl={
            <RefreshControl
              testID="pantry-refresh-control"
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.bgElevated}
            />
          }
          alwaysBounceVertical={true}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xs,
            paddingBottom: 84,
            flexGrow: 1,
          }}
          renderSectionHeader={({ section }) => (
            <View style={{ marginTop: theme.spacing.sm }}>
              <Text
                testID={`record-section-${section.key}`}
                style={{
                  color: theme.colors.textMuted,
                  textTransform: 'uppercase',
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  marginBottom: theme.spacing.sm,
                }}
              >
                {section.title} · {section.data.length}
              </Text>
            </View>
          )}
        />
      ) : (
        // FILTERED / SORTED VIEW: Paginated FlatList + Result Count Bar + Controls + Pagination
        <FlatList
          testID="pantry-record-list"
          data={paginatedItems}
          scrollEnabled
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ListHeaderComponent={
            <View style={styles.headerStack}>
              {resolvedHeader}
              {renderControls()}
              {totalCount > 0 ? (
                <View style={styles.resultsBar}>
                  <Text style={[styles.resultsText, { color: theme.colors.textMuted }]}>
                    Showing {paginatedItems.length} of {totalCount} items
                  </Text>
                </View>
              ) : null}
            </View>
          }
          ListEmptyComponent={renderFilterEmptyState}
          ListFooterComponent={renderPaginationFooter}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.25}
          onScrollBeginDrag={handleScrollBegin}
          onMomentumScrollBegin={handleScrollBegin}
          refreshControl={
            <RefreshControl
              testID="pantry-refresh-control"
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
              progressBackgroundColor={theme.colors.bgElevated}
            />
          }
          alwaysBounceVertical={true}
          contentContainerStyle={{
            gap: theme.spacing.md,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.xs,
            paddingBottom: 84,
            flexGrow: 1,
          }}
        />
      )}

      <PantryFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        filters={filters}
        onApply={setFilters}
        records={records}
      />

      <QuickEditModal
        visible={Boolean(editingRecord)}
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
        onSave={handleSaveEdit}
      />

      {selectionMode && (
        <View
          testID="bulk-action-bar"
          style={[
            styles.bulkActionBar,
            {
              bottom: Math.max(insets.bottom, 16),
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.bulkActionCountWrap}>
            <Text
              testID="bulk-selected-count"
              style={[styles.bulkActionCountText, { color: theme.colors.text }]}
            >
              {selectedIds.size} selected
            </Text>
            <Pressable
              testID="bulk-select-all-btn"
              accessibilityRole="button"
              accessibilityLabel={
                selectedIds.size === allSelectableItems.length
                  ? 'Deselect All'
                  : 'Select All'
              }
              onPress={handleSelectAll}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.bulkActionSelectAllText,
                  { color: theme.colors.primary },
                ]}
              >
                {selectedIds.size === allSelectableItems.length
                  ? 'Deselect All'
                  : 'Select All'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.bulkActionButtonsRow}>
            <Pressable
              testID="bulk-cancel-btn"
              accessibilityRole="button"
              accessibilityLabel="Cancel selection"
              onPress={handleCancelSelection}
              style={[
                styles.bulkCancelBtn,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.bg,
                },
              ]}
            >
              <Text
                style={[
                  styles.bulkCancelBtnText,
                  { color: theme.colors.textMuted },
                ]}
              >
                Cancel
              </Text>
            </Pressable>

            <Pressable
              testID="bulk-move-btn"
              accessibilityRole="button"
              accessibilityLabel="Move selected items to scope"
              disabled={selectedIds.size === 0}
              onPress={() => setBulkScopeModalVisible(true)}
              style={[
                styles.bulkMoveBtn,
                {
                  backgroundColor:
                    selectedIds.size === 0
                      ? theme.colors.border
                      : theme.colors.primary,
                  opacity: selectedIds.size === 0 ? 0.6 : 1,
                },
              ]}
            >
              <Ionicons name="swap-horizontal-outline" size={18} color="#FFFFFF" />
              <Text style={styles.bulkMoveBtnText}>Move to...</Text>
            </Pressable>
          </View>
        </View>
      )}

      <BulkScopeModal
        visible={bulkScopeModalVisible}
        onClose={() => setBulkScopeModalVisible(false)}
        selectedRecordIds={Array.from(selectedIds)}
        records={records}
        onSuccess={handleMovedBulk}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerStack: {
    gap: 12,
  },
  controlsWrap: {
    gap: 10,
  },
  resultsBar: {
    paddingVertical: 4,
  },
  resultsText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  loadingFooterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  endFooterText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyFilterCard: {
    alignItems: 'center',
    borderWidth: 1,
    gap: 10,
    padding: 24,
    marginVertical: 16,
  },
  emptyFilterIconWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyFilterTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyFilterBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  clearFiltersBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  clearFiltersBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  bulkActionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 1000,
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  bulkActionCountWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulkActionCountText: {
    fontSize: 14,
    fontWeight: '700',
  },
  bulkActionSelectAllText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bulkActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulkCancelBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  bulkCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  bulkMoveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  bulkMoveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
