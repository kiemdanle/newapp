import React, { useCallback, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { ProductDraftRow, ProductDraftStatus } from '@expyrico/shared';
import { useProductDrafts, useCreateOrResumeDraft } from '../../../src/api/products';
import { PrivateProductImage } from '../../../src/api/product-private-image';
import { EmptyState } from '../../../src/components/EmptyState';
import { Button } from '../../../src/components/Button';
import { ManualCodeEntryModal } from '../../../src/components/ManualCodeEntryModal';
import { DraftPantryAddModal } from '../../../src/features/products/DraftPantryAddModal';
import { useTheme } from '../../../src/theme/useTheme';
import { formatDate } from '../../../src/utils/country-format';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';

type DraftTab = 'all' | 'active' | 'pending' | 'draft';

const TABS: Array<{ id: DraftTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'pending', label: 'In review' },
  { id: 'draft', label: 'Drafts' },
];

const STATUS_CONFIG: Record<ProductDraftStatus, { label: string; text: string; bg: string }> = {
  active: { label: 'Catalog Active', text: '#3A8F6F', bg: '#D6F0E6' },
  pending: { label: 'Awaiting review', text: '#B45309', bg: '#FEEFC3' },
  draft: { label: 'Draft', text: '#8C8C85', bg: '#F0F0ED' },
  changes_required: { label: 'Changes requested', text: '#E0442A', bg: '#FDE8E8' },
};
function formatUpdatedAt(iso: string): string {
  return formatDate(iso, null, { style: 'medium' });
}

interface DraftRowProps {
  item: ProductDraftRow;
  onPress: (item: ProductDraftRow) => void;
  onAddPress: (item: ProductDraftRow) => void;
  isSubmitting?: boolean;
}

function DraftRow({ item, onPress, onAddPress, isSubmitting }: DraftRowProps) {
  const theme = useTheme();
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
  const canAddDirectly = item.status === 'active' || item.status === 'pending';

  return (
    <Pressable
      testID={`draft-row-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${statusCfg.label}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        borderRadius: theme.radii.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
        marginBottom: theme.spacing.sm,
      })}
    >
      {item.cover ? (
        item.cover.thumbnailUrl.startsWith('http') ? (
          <Image
            testID="draft-row-cover"
            source={{ uri: item.cover.thumbnailUrl }}
            style={{ width: 48, height: 48, borderRadius: theme.radii.sm }}
          />
        ) : (
          <PrivateProductImage
            testID="draft-row-cover"
            target={{ kind: 'draft', productId: item.id }}
            photoId={item.cover.photoId}
            variant="thumb"
            style={{ width: 48, height: 48, borderRadius: theme.radii.sm }}
          />
        )
      ) : (
        <View
          testID="draft-row-cover-placeholder"
          style={{
            width: 48,
            height: 48,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.bgGlass,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="cube-outline" size={24} color={theme.colors.textMuted} />
        </View>
      )}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: theme.colors.text, fontWeight: '600' }} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
          Updated {formatUpdatedAt(item.updatedAt)}
        </Text>
        {item.status === 'changes_required' && item.moderationFeedback ? (
          <Text style={{ color: theme.colors.danger, fontSize: 12 }} numberOfLines={2}>
            {item.moderationFeedback}
          </Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        <View style={{ backgroundColor: statusCfg.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radii.sm }}>
          <Text style={{ color: statusCfg.text, fontSize: 11, fontWeight: '700' }}>
            {statusCfg.label}
          </Text>
        </View>
        {canAddDirectly ? (
          <Pressable
            testID={`draft-add-btn-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.name} to pantry`}
            onPress={(e) => {
              e?.stopPropagation?.();
              onAddPress(item);
            }}
            style={({ pressed }) => [
              styles.inlineAddBtn,
              {
                backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
                opacity: isSubmitting ? 0.6 : 1,
              },
            ]}
            disabled={isSubmitting}
          >
            <Ionicons name="add" size={14} color="#FFFFFF" />
            <Text style={styles.inlineAddBtnText}>Add</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ProductDraftsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const queryClient = useQueryClient();
  const [selectedTab, setSelectedTab] = useState<DraftTab>('all');
  const [selectedPantryProduct, setSelectedPantryProduct] = useState<ProductDraftRow | null>(null);
  const [isManualModalVisible, setIsManualModalVisible] = useState(false);

  const q = useProductDrafts(selectedTab === 'all' ? 'all' : selectedTab);
  const createOrResumeDraft = useCreateOrResumeDraft();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];

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
      if (Platform.OS === 'ios' && ActionSheetIOS && typeof ActionSheetIOS.showActionSheetWithOptions === 'function') {
        try {
          ActionSheetIOS.showActionSheetWithOptions(
            {
              title: item.name,
              options: ['Add to Pantry', 'View Product Details', 'Cancel'],
              cancelButtonIndex: 2,
            },
            (buttonIndex) => {
              if (buttonIndex === 0) {
                setSelectedPantryProduct(item);
              } else if (buttonIndex === 1) {
                openDraft(item);
              }
            },
          );
          return;
        } catch {
          // Fall through to Alert below
        }
      }
      Alert.alert(item.name, 'What would you like to do with this product?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View Details',
          onPress: () => openDraft(item),
        },
        {
          text: 'Add to Pantry',
          onPress: () => setSelectedPantryProduct(item),
        },
      ]);
    } else {
      openDraft(item);
    }
  };
  const handleOpenAddOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Scan Barcode / QR Code', 'Enter Code Manually', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            navigation.push('Scan');
          } else if (buttonIndex === 1) {
            setIsManualModalVisible(true);
          }
        },
      );
    } else {
      Alert.alert('Add Product Draft', 'How would you like to add the product?', [
        {
          text: 'Scan Code',
          onPress: () => navigation.push('Scan'),
        },
        {
          text: 'Enter Manually',
          onPress: () => setIsManualModalVisible(true),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
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

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700' }}>My product drafts</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
            Products you've contributed or are drafting for the catalog.
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
          <Text style={[styles.headerAddBtnText, { color: theme.colors.primaryDark }]}>+ Add draft</Text>
        </Pressable>
      </View>

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
              onPress={() => setSelectedTab(tab.id)}
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

      {q.isError ? (
        <View style={{ padding: 20 }}>
          <Text style={{ color: theme.colors.danger }}>Couldn't load your drafts. Pull down or reopen to retry.</Text>
        </View>
      ) : (
        <FlatList
          testID="drafts-list"
          data={items}
          keyExtractor={(d) => d.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
          renderItem={({ item }) => (
            <DraftRow
              item={item}
              onPress={handleRowPress}
              onAddPress={handleAddDirect}
            />
          )}
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
                  icon="document-text-outline"
                  title={selectedTab === 'active' ? 'No active products' : 'No drafts yet'}
                  body="Scan a barcode or type code manually to add products to the catalog."
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

      {/* Floating Action Button (FAB) when drafts list is populated */}
      {items.length > 0 && (
        <Pressable
          testID="drafts-fab-btn"
          accessibilityRole="button"
          accessibilityLabel="Add new product draft"
          onPress={handleOpenAddOptions}
          style={({ pressed }) => [
            styles.fab,
            {
              backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 3 },
            },
          ]}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
          <Text style={styles.fabText}>New Draft</Text>
        </Pressable>
      )}

      <ManualCodeEntryModal
        visible={isManualModalVisible}
        onClose={() => setIsManualModalVisible(false)}
        onSubmit={handleManualCodeSubmit}
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
    </View>
  );
}

const styles = StyleSheet.create({
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
  inlineAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  inlineAddBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
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
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
