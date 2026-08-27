// apps/mobile/src/features/giveaways/PantrySelectModal.tsx
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product } from '@expyrico/shared';
import { useAllActiveRecords, type LocalRecord } from '../../api/records';
import { useProduct } from '../../api/products';
import { useSessionStore } from '../../auth/session-store';
import { useTheme } from '../../theme/useTheme';
import { formatDate } from '../../utils/country-format';
import { ProductThumbnail } from '../../components/ProductThumbnail';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../records/expiryStatus';

export interface PantrySelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectRecord: (record: LocalRecord, product?: Product | null) => void;
}

function PantryItemRow({
  record,
  onSelect,
  userCountry,
}: {
  record: LocalRecord;
  onSelect: (record: LocalRecord, product?: Product | null) => void;
  userCountry: string | null;
}) {
  const theme = useTheme();
  const { data: product } = useProduct(record.productId ?? undefined);
  const displayName = record.customName || product?.name || 'Pantry item';
  const brand = product?.brand;
  const category = record.category || product?.category;
  const imageUrl =
    record.photoUrl ||
    product?.imageUrl ||
    (product?.photos && (product.photos[0]?.displayUrl || product.photos[0]?.thumbnailUrl)) ||
    null;

  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  const statusBg =
    status === 'amber'
      ? theme.colors.accentLight
      : status === 'red'
        ? theme.colors.bgGlass
        : theme.colors.primaryLight;

  return (
    <Pressable
      testID={`pantry-select-item-${record.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Select ${displayName}, quantity ${record.quantity} ${record.unit}`}
      onPress={() => onSelect(record, product)}
      style={({ pressed }) => [
        styles.itemCard,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.thumbnailWrap}>
        <ProductThumbnail
          product={product}
          photoUrl={record.photoUrl}
          size={48}
          fallbackIcon="cube-outline"
          style={[styles.thumbnail, { borderRadius: theme.radii.sm }]}
        />
      </View>

      <View style={styles.itemInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.nameText, { color: theme.colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          {record.householdId ? (
            <View style={[styles.householdBadge, { backgroundColor: theme.colors.bgGlass }]}>
              <Ionicons name="home-outline" size={10} color={theme.colors.primaryDark} />
              <Text style={[styles.householdText, { color: theme.colors.primaryDark }]}>Household</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.detailRow}>
          {brand ? (
            <Text style={[styles.brandText, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {brand}
            </Text>
          ) : null}
          {category && brand ? (
            <Text style={[styles.dotSeparator, { color: theme.colors.textMuted }]}>·</Text>
          ) : null}
          {category ? (
            <Text style={[styles.categoryText, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {category}
            </Text>
          ) : null}
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.qtyBadge, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border }]}>
            <Text style={[styles.qtyText, { color: theme.colors.text }]}>
              Stock: <Text style={{ fontWeight: '700' }}>{record.quantity} {record.unit}</Text>
            </Text>
          </View>

          {record.expiryDate ? (
            <View style={[styles.expiryBadge, { backgroundColor: statusBg }]}>
              <Ionicons name="calendar-outline" size={11} color={statusColor} />
              <Text style={[styles.expiryText, { color: statusColor }]}>
                {formatDate(record.expiryDate, userCountry)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.selectIconWrap}>
        <Ionicons name="chevron-forward" size={18} color={theme.colors.primary} />
      </View>
    </Pressable>
  );
}

export function PantrySelectModal({ visible, onClose, onSelectRecord }: PantrySelectModalProps) {
  const theme = useTheme();
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const records = useAllActiveRecords();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return records;
    return records.filter((r) => {
      const nameMatch = r.customName?.toLowerCase().includes(q);
      const catMatch = r.category?.toLowerCase().includes(q);
      const notesMatch = r.notes?.toLowerCase().includes(q);
      return Boolean(nameMatch || catMatch || notesMatch);
    });
  }, [records, searchQuery]);

  const handleSelect = (record: LocalRecord, product?: Product | null) => {
    onSelectRecord(record, product);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View
          testID="pantry-select-modal"
          style={[
            styles.sheetContainer,
            {
              backgroundColor: theme.colors.bg,
              borderTopLeftRadius: theme.radii.lg,
              borderTopRightRadius: theme.radii.lg,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.sheetHeader, { borderBottomColor: theme.colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.sheetTitle, { color: theme.colors.text }]}>
                Select from Pantry
              </Text>
              <Text style={[styles.sheetSubtitle, { color: theme.colors.textMuted }]}>
                Choose an item to auto-fill details, photos, and expiration date.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close pantry selection"
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: theme.colors.bgElevated }]}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={styles.searchWrap}>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
              <TextInput
                testID="pantry-select-search-input"
                accessibilityLabel="Search pantry items"
                placeholder="Search by name, category, or note…"
                placeholderTextColor={theme.colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={[styles.searchInput, { color: theme.colors.text }]}
              />
              {searchQuery ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setSearchQuery('')}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={16} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* List of items */}
          <FlatList
            testID="pantry-items-list"
            keyboardShouldPersistTaps="handled"
            data={filteredRecords}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <PantryItemRow
                record={item}
                onSelect={handleSelect}
                userCountry={userCountry}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="file-tray-outline" size={40} color={theme.colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  {searchQuery ? 'No matching pantry items' : 'Your pantry is empty'}
                </Text>
                <Text style={[styles.emptySubtitle, { color: theme.colors.textMuted }]}>
                  {searchQuery
                    ? 'Try searching with another keyword.'
                    : 'Add items to your pantry first or enter giveaway details manually.'}
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    maxHeight: '85%',
    minHeight: 400,
    width: '100%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  searchWrap: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    gap: 12,
  },
  thumbnailWrap: {
    width: 48,
    height: 48,
  },
  thumbnail: {
    width: 48,
    height: 48,
  },
  thumbnailPlaceholder: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  householdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  householdText: {
    fontSize: 10,
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandText: {
    fontSize: 12,
  },
  dotSeparator: {
    fontSize: 12,
    marginHorizontal: 4,
  },
  categoryText: {
    fontSize: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  qtyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  qtyText: {
    fontSize: 11,
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  expiryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  selectIconWrap: {
    paddingLeft: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
  },
});
