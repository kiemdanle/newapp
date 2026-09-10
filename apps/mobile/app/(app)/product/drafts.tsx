import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { ProductDraftRow } from '@expyrico/shared';
import { useProductDrafts, useCreateOrResumeDraft, useDiscardDraft } from '../../../src/api/products';
import { PrivateProductImage } from '../../../src/api/product-private-image';
import { EmptyState } from '../../../src/components/EmptyState';
import { Button } from '../../../src/components/Button';
import { ManualCodeEntryModal } from '../../../src/components/ManualCodeEntryModal';
import { DraftPantryAddModal } from '../../../src/features/products/DraftPantryAddModal';
import { ProductActionModal } from '../../../src/features/products/ProductActionModal';
import { AddDraftOptionsModal } from '../../../src/features/products/AddDraftOptionsModal';
import { DraftGridCard } from '../../../src/features/products/DraftGridCard';
import { DraftSwipeableRow } from '../../../src/features/products/DraftSwipeableRow';
import { DraftUndoToast, type PendingDiscardEntry } from '../../../src/features/products/DraftUndoToast';
import { DraftsSearchBar } from '../../../src/features/products/DraftsSearchBar';
import { DraftsSortPills, type DraftSortOption } from '../../../src/features/products/DraftsSortPills';
import { useUiPreferencesStore } from '../../../src/store/uiPreferencesStore';
import { useTheme } from '../../../src/theme/useTheme';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';

type DraftTab = 'all' | 'active' | 'pending' | 'draft';

const TABS: Array<{ id: DraftTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'In review' },
  { id: 'draft', label: 'Drafts' },
];


export default function ProductDraftsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const queryClient = useQueryClient();
  const viewMode = useUiPreferencesStore((s) => s.draftsViewMode);
  const setDraftsViewMode = useUiPreferencesStore((s) => s.setDraftsViewMode);
  const [selectedTab, setSelectedTab] = useState<DraftTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSort, setSelectedSort] = useState<DraftSortOption>('newest');
  const [selectedPantryProduct, setSelectedPantryProduct] = useState<ProductDraftRow | null>(null);
  const [actionProduct, setActionProduct] = useState<ProductDraftRow | null>(null);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);
  const [isAddOptionsVisible, setIsAddOptionsVisible] = useState(false);
  const q = useProductDrafts(selectedTab === 'all' ? 'all' : selectedTab);
  const createOrResumeDraft = useCreateOrResumeDraft();
  const discardDraftMutation = useDiscardDraft();
  const discardDraftMutationRef = useRef(discardDraftMutation);
  discardDraftMutationRef.current = discardDraftMutation;

  // Multi-draft discard queue with independent 5-second timers
  const [pendingDiscards, setPendingDiscards] = useState<Map<string, PendingDiscardEntry>>(new Map());
  const activeSwipeableRef = useRef<Swipeable | null>(null);
  const pendingDiscardsRef = useRef(pendingDiscards);
  pendingDiscardsRef.current = pendingDiscards;
  const handleSwipeableWillOpen = useCallback((ref: Swipeable) => {
    if (activeSwipeableRef.current && activeSwipeableRef.current !== ref) {
      activeSwipeableRef.current.close();
    }
    activeSwipeableRef.current = ref;
  }, []);

  const rawItems = q.data?.pages.flatMap((p) => p.items) ?? [];

  const items = useMemo(() => {
    let list = rawItems.filter((item) => !pendingDiscards.has(item.id));

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      list = list.filter((item) => {
        const nameMatch = item.name.toLowerCase().includes(query);
        const barcodeMatch = item.identifier.value.toLowerCase().includes(query);
        const feedbackMatch = item.moderationFeedback?.toLowerCase().includes(query);
        return nameMatch || barcodeMatch || feedbackMatch;
      });
    }

    const sorted = [...list];
    if (selectedSort === 'newest') {
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } else if (selectedSort === 'oldest') {
      sorted.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    } else if (selectedSort === 'name_asc') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (selectedSort === 'name_desc') {
      sorted.sort((a, b) => b.name.localeCompare(a.name));
    }

    return sorted;
  }, [rawItems, pendingDiscards, searchQuery, selectedSort]);
  // Timer cleanup on unmount: flush any pending discards that were not undone
  useEffect(() => {
    return () => {
      pendingDiscardsRef.current.forEach((entry) => {
        clearTimeout(entry.timer);
        if (!entry.isCommitting) {
          entry.isCommitting = true;
          void discardDraftMutationRef.current.mutateAsync(entry.item.id).catch((err: unknown) => {
            const msg = err instanceof Error ? err.message : 'Could not discard draft';
            Alert.alert('Discard Failed', msg);
            void queryClient.invalidateQueries({ queryKey: ['products', 'drafts'] });
          });
        }
      });
    };
  }, [queryClient]);
  const handleEdit = useCallback(
    (item: ProductDraftRow) => {
      if (item.status === 'active') {
        navigation.push('ProductEdit', { id: item.id });
      } else if (item.status === 'pending') {
        setActionProduct(item);
      } else {
        openDraft(item);
      }
    },
    [navigation],
  );

  const handleDeleteDraft = useCallback(
    (item: ProductDraftRow) => {
      const timer = setTimeout(async () => {
        // Mark as committing
        setPendingDiscards((prev) => {
          const next = new Map(prev);
          const current = next.get(item.id);
          if (current) {
            next.set(item.id, { ...current, isCommitting: true });
          }
          pendingDiscardsRef.current = next;
          return next;
        });

        try {
          await discardDraftMutation.mutateAsync(item.id);
          setPendingDiscards((prev) => {
            const next = new Map(prev);
            next.delete(item.id);
            pendingDiscardsRef.current = next;
            return next;
          });
        } catch (err: unknown) {
          // Failure rollback: restore item from pendingDiscards and notify
          setPendingDiscards((prev) => {
            const next = new Map(prev);
            next.delete(item.id);
            pendingDiscardsRef.current = next;
            return next;
          });
          void q.refetch();
          const msg = err instanceof Error ? err.message : 'Could not discard draft';
          Alert.alert('Discard Failed', msg);
        }
      }, 5000);
      setPendingDiscards((prev) => {
        const next = new Map(prev);
        const existing = next.get(item.id);
        if (existing) {
          clearTimeout(existing.timer);
        }
        next.set(item.id, {
          item,
          timer,
          deadline: Date.now() + 5000,
          isCommitting: false,
        });
        pendingDiscardsRef.current = next;
        return next;
      });
    },
    [discardDraftMutation, q],
  );
  const handleUndo = useCallback((id: string) => {
    setPendingDiscards((prev) => {
      const next = new Map(prev);
      const entry = next.get(id);
      if (entry && !entry.isCommitting) {
        clearTimeout(entry.timer);
        next.delete(id);
      }
      pendingDiscardsRef.current = next;
      return next;
    });
  }, []);
  const lastAddTapRef = useRef(0);
  const refetchRef = useRef(q.refetch);
  refetchRef.current = q.refetch;

  useFocusEffect(
    useCallback(() => {
      void refetchRef.current();
    }, []),
  );

  const openDraft = (item: ProductDraftRow) => {
    const identifier = item.identifier;
    navigation.push('ProductNew', {
      barcode: identifier.kind === 'barcode' ? identifier.value : '',
      qr: identifier.kind === 'qr' ? identifier.value : '',
      productId: item.id,
      resume: item.status === 'pending' ? 'pending' : 'edit',
      feedback: item.status === 'changes_required' ? (item.moderationFeedback ?? undefined) : undefined,
    });
  };

  const handleAddDirect = (item: ProductDraftRow) => {
    const now = Date.now();
    if (now - lastAddTapRef.current < 300) return;
    lastAddTapRef.current = now;
    setSelectedPantryProduct(item);
  };

  const handleRowPress = (item: ProductDraftRow) => {
    if (item.status === 'active' || item.status === 'pending') {
      setActionProduct(item);
    } else {
      openDraft(item);
    }
  };
  const handleOpenAddOptions = () => {
    setIsAddOptionsVisible(true);
  };

  const handleManualCodeSubmit = async (code: string, kind: 'barcode' | 'qr') => {
    const { product } = await createOrResumeDraft.mutateAsync({
      barcode: kind === 'barcode' ? code : null,
      qrPayload: kind === 'qr' ? code : null,
    });

    navigation.push('ProductNew', {
      barcode: kind === 'barcode' ? code : '',
      qr: kind === 'qr' ? code : '',
      productId: product.id,
      resume: product.status === 'pending' ? 'pending' : 'edit',
    });
  };
  const scrollY = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<ProductDraftRow>>(null);
  const [collapsibleHeight, setCollapsibleHeight] = useState(72);
  const [stickyHeight, setStickyHeight] = useState(136);

  const handleToggleViewMode = useCallback(() => {
    scrollY.setValue(0);
    const next = viewMode === 'grid' ? 'list' : 'grid';
    void setDraftsViewMode(next);
  }, [viewMode, setDraftsViewMode, scrollY]);

  const handleSelectTab = useCallback(
    (tabId: DraftTab) => {
      scrollY.setValue(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      setSelectedTab(tabId);
    },
    [scrollY],
  );

  const handleSearchChange = useCallback(
    (text: string) => {
      scrollY.setValue(0);
      listRef.current?.scrollToOffset({ offset: 0, animated: false });
      setSearchQuery(text);
    },
    [scrollY],
  );

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, collapsibleHeight],
    outputRange: [0, -collapsibleHeight],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, collapsibleHeight * 0.7, collapsibleHeight],
    outputRange: [1, 0.2, 0],
    extrapolate: 'clamp',
  });

  const stickyBorderOpacity = scrollY.interpolate({
    inputRange: [0, collapsibleHeight * 0.8, collapsibleHeight],
    outputRange: [0, 0.5, 1],
    extrapolate: 'clamp',
  });

  const listTopPadding = collapsibleHeight + stickyHeight + 8;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {q.isError ? (
        <View style={{ padding: 20, paddingTop: listTopPadding }}>
          <Text style={{ color: theme.colors.danger }}>Couldn't load your drafts. Pull down or reopen to retry.</Text>
        </View>
      ) : (
        <Animated.FlatList
          ref={listRef as unknown as React.RefObject<FlatList<ProductDraftRow>>}
          key={viewMode}
          testID="drafts-list"
          data={items}
          numColumns={viewMode === 'grid' ? 2 : 1}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
          keyExtractor={(d) => d.id}
          contentContainerStyle={[
            viewMode === 'grid'
              ? { paddingHorizontal: 15, paddingBottom: 140 }
              : { paddingHorizontal: 20, paddingBottom: 140, gap: 10 },
            { paddingTop: listTopPadding },
          ]}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { y: scrollY } } }],
            { useNativeDriver: true },
          )}
          scrollEventThrottle={16}
          renderItem={({ item }) =>
            viewMode === 'grid' ? (
              <DraftGridCard
                item={item}
                onPress={handleRowPress}
                onEdit={handleEdit}
                onAddPress={handleAddDirect}
                onDelete={handleDeleteDraft}
                onSwipeableWillOpen={handleSwipeableWillOpen}
                isSubmitting={discardDraftMutation.isPending}
              />
            ) : (
              <DraftSwipeableRow
                item={item}
                onPress={handleRowPress}
                onEdit={handleEdit}
                onAddToPantry={handleAddDirect}
                onDelete={handleDeleteDraft}
                onSwipeableWillOpen={handleSwipeableWillOpen}
                isSubmitting={discardDraftMutation.isPending}
              />
            )
          }
          refreshing={Boolean(q.isRefetching && !q.isFetchingNextPage)}
          onRefresh={() => q?.refetch?.()}
          onEndReached={() => {
            if (q.hasNextPage) q.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            q.isLoading ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <View style={styles.emptyContainer}>
                <EmptyState
                  icon="bookmark-outline"
                  title={selectedTab === 'active' ? 'No active templates' : 'No templates yet'}
                  body="Scan a barcode or enter code manually to create your quick-add templates."
                />
                <View style={styles.emptyActionButtons}>
                  <Button
                    testID="drafts-empty-scan-btn"
                    label="Scan product barcode"
                    onPress={() => navigation.push('Scan')}
                    variant="primary"
                  />
                  <Button
                    testID="drafts-empty-manual-btn"
                    label="Enter code manually"
                    onPress={() => setIsManualModalVisible(true)}
                    variant="outline"
                  />
                </View>
              </View>
            )
          }
          ListFooterComponent={q.isFetchingNextPage ? <ActivityIndicator color={theme.colors.primary} /> : null}
        />
      )}

      {/* Floating Animated Header Container */}
      <Animated.View
        testID="drafts-header-container"
        style={[
          styles.headerContainer,
          {
            backgroundColor: theme.colors.bg,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Collapsible Big Header: slides up and fades away on scroll */}
        <Animated.View
          style={[styles.header, { opacity: headerOpacity }]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - collapsibleHeight) > 2) {
              setCollapsibleHeight(h);
            }
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700' }}>Product Templates</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
              Quick-add templates for frequently purchased products
            </Text>
          </View>

          <Pressable
            testID="drafts-add-header-btn"
            accessibilityRole="button"
            accessibilityLabel="Add new product draft"
            onPress={handleOpenAddOptions}
            style={({ pressed }) => [
              styles.headerAddBtn,
              {
                backgroundColor: theme.colors.primaryLight,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons name="add" size={18} color={theme.colors.primaryDark} />
            <Text style={[styles.headerAddBtnText, { color: theme.colors.primaryDark }]}>Add template</Text>
          </Pressable>
        </Animated.View>

        {/* Sticky Controls: Pinned at top once big header collapses */}
        <View
          style={[
            styles.stickyControls,
            {
              backgroundColor: theme.colors.bg,
            },
          ]}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - stickyHeight) > 2) {
              setStickyHeight(h);
            }
          }}
        >
          {/* Search Bar & View Mode Toggle */}
          <DraftsSearchBar
            value={searchQuery}
            onChangeText={handleSearchChange}
            viewMode={viewMode}
            onToggleViewMode={handleToggleViewMode}
          />

          {/* Sort Pills */}
          <DraftsSortPills
            selectedSort={selectedSort}
            onSelectSort={setSelectedSort}
          />
          {/* Filter Tabs Bar */}
          <View style={styles.tabBar} accessibilityRole="tablist">
            {TABS.map((tab) => {
              const isActive = selectedTab === tab.id;
              return (
                <Pressable
                  key={tab.id}
                  testID={`drafts-tab-${tab.id}`}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`Filter by ${tab.label}`}
                  onPress={() => handleSelectTab(tab.id)}
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

          {/* Dedicated 1px Hairline Separator animated with native opacity */}
          <Animated.View
            style={[
              styles.stickyBorder,
              {
                backgroundColor: theme.colors.border,
                opacity: stickyBorderOpacity,
              },
            ]}
          />
        </View>
      </Animated.View>

      {/* Centered Dual-Action Bottom Dock (Manually input + Scan an item) */}
      {items.length > 0 && (
        <View style={styles.bottomDockWrapper} pointerEvents="box-none">
          <View
            style={[
              styles.dualActionWrapper,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            {/* Left button: Manually input */}
            <Pressable
              testID="drafts-manual-add-action"
              accessibilityRole="button"
              accessibilityLabel="Manually input item"
              onPress={() => setIsManualModalVisible(true)}
              style={({ pressed }) => [
                styles.manualInputButton,
                {
                  backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                  borderRightColor: theme.colors.border,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Ionicons
                name="create-outline"
                size={18}
                color={theme.colors.primaryDark}
                style={styles.actionIcon}
              />
              <Text
                style={[styles.manualInputLabel, { color: theme.colors.text }]}
                numberOfLines={1}
              >
                Manually input
              </Text>
            </Pressable>

            {/* Right button: Scan an item */}
            <Pressable
              testID="drafts-scan-action"
              accessibilityRole="button"
              accessibilityLabel="Scan an item"
              onPress={() => navigation.push('Scan')}
              style={({ pressed }) => [
                styles.scanActionButton,
                {
                  backgroundColor: '#F5A623',
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Ionicons
                name="scan-outline"
                size={20}
                color="#2C2C28"
                style={styles.actionIcon}
              />
              <Text style={[styles.scanActionLabel, { color: '#2C2C28' }]} numberOfLines={1}>
                Scan an item
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      <ManualCodeEntryModal
        visible={isManualModalVisible}
        onClose={() => setIsManualModalVisible(false)}
        onSubmit={handleManualCodeSubmit}
      />

      <ProductActionModal
        visible={Boolean(actionProduct)}
        product={actionProduct}
        onClose={() => setActionProduct(null)}
        onAddToPantry={(prod) => {
          setActionProduct(null);
          setSelectedPantryProduct(prod);
        }}
        onViewDetails={(prod) => {
          setActionProduct(null);
          openDraft(prod);
        }}
      />

      <DraftPantryAddModal
        visible={Boolean(selectedPantryProduct)}
        product={selectedPantryProduct}
        onClose={() => setSelectedPantryProduct(null)}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['records'] });
          queryClient.invalidateQueries({ queryKey: ['products', 'drafts'] });
        }}
      />
      <AddDraftOptionsModal
        visible={isAddOptionsVisible}
        onClose={() => setIsAddOptionsVisible(false)}
        onScan={() => navigation.push('Scan')}
        onManualEntry={() => setIsManualModalVisible(true)}
      />

      <DraftUndoToast
        entries={Array.from(pendingDiscards.values())}
        onUndo={handleUndo}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  stickyControls: {
    paddingTop: 4,
  },
  stickyBorder: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    gap: 12,
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  headerAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  gridRow: {
    justifyContent: 'space-between',
    paddingHorizontal: 15,
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
  emptyContainer: {
    paddingTop: 20,
    gap: 20,
    alignItems: 'center',
  },
  emptyActionButtons: {
    width: '100%',
    gap: 10,
    marginTop: 10,
  },
  bottomDockWrapper: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  dualActionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  manualInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    height: 48,
    borderRightWidth: 1,
    gap: 6,
  },
  manualInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  scanActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    height: 48,
    gap: 6,
  },
  scanActionLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  actionIcon: {
    marginRight: -2,
  },
});
