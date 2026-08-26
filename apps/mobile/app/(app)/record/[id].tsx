import React, { useState, useCallback } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecord, patchLocalRecord, deleteLocalRecord } from '../../../src/api/records';
import { useProduct } from '../../../src/api/products';
import { useTheme } from '../../../src/theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../../../src/features/records/expiryStatus';
import { QuickEditModal } from '../../../src/features/records/QuickEditModal';
import { Button } from '../../../src/components/Button';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';

function getRelativeExpiryLabel(expiryDateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${expiryDateStr}T00:00:00Z`);
  const diffDays = Math.round((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  return expiryDateStr;
}

export default function RecordDetail() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const insets = useSafeAreaInsets();
  const { id } = useRoute().params as { id: string };
  const record = useRecord(id);
  const { data: product } = useProduct(record?.productId ?? undefined);
  const [showEditModal, setShowEditModal] = useState(false);

  if (!record) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.bgGlass }]}>
          <Ionicons name="file-tray-outline" size={32} color={theme.colors.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Item not found</Text>
        <Text style={[styles.emptySubcopy, { color: theme.colors.textMuted }]}>
          This record may have been removed from your pantry.
        </Text>
        <Button label="Back to pantry" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const displayName = record.customName || product?.name || 'Pantry Item';
  const brand = product?.brand;
  const category = record.category || product?.category;
  const imageUrl = record.photoUrl || product?.imageUrl || (product?.photos && product.photos[0]?.url) || null;
  const barcode = product?.barcode;
  const description = product?.description;
  const shelfLife = product?.defaultShelfLifeDays;

  const mark = async (status: 'consumed' | 'discarded') => {
    await patchLocalRecord(record.id, { status });
    navigation.goBack();
  };

  const remove = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${displayName}"? It will be removed from your pantry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteLocalRecord(record.id);
            navigation.goBack();
          },
        },
      ],
    );
  };

  const handleStepQuantity = async (delta: number) => {
    const newQty = Math.max(1, record.quantity + delta);
    await patchLocalRecord(record.id, { quantity: newQty });
  };

  const handleSaveQuickEdit = async (patch: {
    customName?: string | null;
    quantity: number;
    unit: string;
    expiryDate: string;
  }) => {
    await patchLocalRecord(record.id, patch);
    setShowEditModal(false);
  };

  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  const statusBg =
    status === 'amber'
      ? theme.colors.accentLight
      : status === 'red'
        ? theme.colors.danger + '18'
        : theme.colors.primaryLight;

  const relativeExpiry = getRelativeExpiryLabel(record.expiryDate);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: insets.bottom + 96,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Photo / Brand Card */}
        {imageUrl ? (
          <View style={[styles.photoHeroWrap, { borderColor: theme.colors.border }]}>
            <Image
              source={{ uri: imageUrl }}
              style={styles.photoHero}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : null}

        {/* Title & Quick Actions Row */}
        <View style={styles.titleCard}>
          <View style={{ flex: 1, gap: 2 }}>
            {brand ? (
              <Text
                style={{
                  color: theme.colors.primaryDark,
                  fontSize: 12,
                  fontWeight: '700',
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                }}
              >
                {brand}
              </Text>
            ) : null}
            <Text
              style={{
                color: theme.colors.text,
                fontSize: 22,
                fontWeight: '700',
                lineHeight: 28,
              }}
            >
              {displayName}
            </Text>
          </View>

          {/* Quick Edit & Delete Header Controls */}
          <View style={styles.headerIcons}>
            <Pressable
              testID="record-edit-header-btn"
              accessibilityRole="button"
              accessibilityLabel="Edit item details"
              onPress={() => setShowEditModal(true)}
              style={({ pressed }) => [
                styles.editPillBtn,
                {
                  backgroundColor: theme.colors.primaryLight,
                  borderColor: theme.colors.primary,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <Ionicons name="pencil" size={14} color={theme.colors.primaryDark} />
              <Text style={[styles.editPillText, { color: theme.colors.primaryDark }]}>Edit</Text>
            </Pressable>
            <Pressable
              testID="record-delete"
              accessibilityRole="button"
              accessibilityLabel="Delete item"
              onPress={remove}
              style={({ pressed }) => [
                styles.iconBtn,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </Pressable>
          </View>
        </View>

        {/* 2-Column Bento Stat Cards: Expiry & Quantity */}
        <View style={styles.bentoRow}>
          {/* Expiry Card (Tap to edit date) */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Expiry status: ${relativeExpiry}. Tap to edit date.`}
            onPress={() => setShowEditModal(true)}
            style={({ pressed }) => [
              styles.bentoCard,
              {
                backgroundColor: statusBg,
                borderColor: status === 'red' ? theme.colors.danger : theme.colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={styles.bentoHeader}>
              <View
                testID={`record-expiry-status-${status}`}
                style={[styles.statusDot, { backgroundColor: statusColor }]}
              />
              <Text style={[styles.bentoLabel, { color: statusColor }]}>EXPIRY</Text>
              <Ionicons name="create-outline" size={14} color={statusColor} style={{ marginLeft: 'auto' }} />
            </View>
            <Text style={[styles.bentoValue, { color: statusColor }]} numberOfLines={1}>
              {relativeExpiry}
            </Text>
            <Text style={[styles.bentoSubtext, { color: statusColor, opacity: 0.85 }]}>
              {record.expiryDate}
            </Text>
          </Pressable>

          {/* Quantity & Stepper Card */}
          <View
            style={[
              styles.bentoCard,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <View style={styles.bentoHeader}>
              <Ionicons name="cube-outline" size={15} color={theme.colors.primary} />
              <Text style={[styles.bentoLabel, { color: theme.colors.textMuted }]}>QUANTITY</Text>
            </View>
            <View style={styles.qtyMainRow}>
              <Text style={[styles.qtyValueText, { color: theme.colors.text }]}>
                {record.quantity}
              </Text>
              <Text style={[styles.qtyUnitText, { color: theme.colors.textMuted }]}>
                {record.unit}
              </Text>
            </View>
            <View style={styles.stepperRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                onPress={() => void handleStepQuantity(-1)}
                style={({ pressed }) => [
                  styles.miniStepBtn,
                  { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="remove" size={16} color={theme.colors.text} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                onPress={() => void handleStepQuantity(1)}
                style={({ pressed }) => [
                  styles.miniStepBtn,
                  { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Ionicons name="add" size={16} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Item Details Bento Card */}
        <View
          style={[
            styles.detailsCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Item Information</Text>

          {category ? (
            <View style={styles.specRow}>
              <View style={styles.specLabelWrap}>
                <Ionicons name="pricetag-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>Category</Text>
              </View>
              <Text style={[styles.specValue, { color: theme.colors.text }]}>{category}</Text>
            </View>
          ) : null}

          {record.store ? (
            <View style={styles.specRow}>
              <View style={styles.specLabelWrap}>
                <Ionicons name="storefront-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>Store</Text>
              </View>
              <Text style={[styles.specValue, { color: theme.colors.text }]}>{record.store}</Text>
            </View>
          ) : null}

          {record.price != null ? (
            <View style={styles.specRow}>
              <View style={styles.specLabelWrap}>
                <Ionicons name="cash-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>Price</Text>
              </View>
              <Text style={[styles.specValue, { color: theme.colors.text }]}>${record.price}</Text>
            </View>
          ) : null}

          {barcode ? (
            <View style={styles.specRow}>
              <View style={styles.specLabelWrap}>
                <Ionicons name="barcode-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>Barcode</Text>
              </View>
              <Text style={[styles.specValue, { color: theme.colors.text, fontFamily: 'monospace' }]}>
                {barcode}
              </Text>
            </View>
          ) : null}

          {shelfLife ? (
            <View style={styles.specRow}>
              <View style={styles.specLabelWrap}>
                <Ionicons name="timer-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>Avg. Shelf Life</Text>
              </View>
              <Text style={[styles.specValue, { color: theme.colors.text }]}>{shelfLife} days</Text>
            </View>
          ) : null}

          {record.purchaseDate ? (
            <View style={styles.specRow}>
              <View style={styles.specLabelWrap}>
                <Ionicons name="calendar-outline" size={15} color={theme.colors.textMuted} />
                <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>Purchased</Text>
              </View>
              <Text style={[styles.specValue, { color: theme.colors.text }]}>{record.purchaseDate}</Text>
            </View>
          ) : null}

          {record.notes ? (
            <View style={[styles.notesBox, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border }]}>
              <Text style={[styles.notesLabel, { color: theme.colors.primaryDark }]}>NOTES</Text>
              <Text style={[styles.notesContent, { color: theme.colors.text }]}>{record.notes}</Text>
            </View>
          ) : null}

          {description ? (
            <View style={{ marginTop: 6, gap: 2 }}>
              <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>Description</Text>
              <Text style={{ color: theme.colors.text, fontSize: 13, lineHeight: 18 }}>{description}</Text>
            </View>
          ) : null}

          {/* Catalog Link Row */}
          {record.productId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View in product catalog"
              onPress={() => navigation.navigate('Product', { id: record.productId! })}
              style={({ pressed }) => [
                styles.catalogRow,
                {
                  backgroundColor: theme.colors.bgGlass,
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.75 : 1,
                },
              ]}
            >
              <View style={[styles.catalogIconBadge, { backgroundColor: theme.colors.primaryLight }]}>
                <Ionicons name="library-outline" size={16} color={theme.colors.primaryDark} />
              </View>
              <Text style={[styles.catalogLinkText, { color: theme.colors.text }]}>
                View product catalog entry
              </Text>
              <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating Bottom Action Toolbar */}
      <View
        style={[
          styles.actionToolbar,
          {
            backgroundColor: theme.colors.bgElevated,
            borderTopColor: theme.colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={styles.actionRow}>
          <View style={{ flex: 1.8 }}>
            <Button
              testID="record-mark-consumed"
              label="Mark as used"
              icon="checkmark-circle-outline"
              variant="primary"
              onPress={() => void mark('consumed')}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              testID="record-mark-discarded"
              label="Discard"
              icon="trash-outline"
              variant="outline"
              onPress={() => void mark('discarded')}
            />
          </View>
        </View>
      </View>
      {/* Quick Edit Modal */}
      <QuickEditModal
        visible={showEditModal}
        record={record}
        productName={displayName}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveQuickEdit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptySubcopy: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 8,
  },
  photoHeroWrap: {
    width: '100%',
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  photoHero: {
    width: '100%',
    height: '100%',
  },
  titleCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 8,
  },
  editPillBtn: {
    minHeight: 38,
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 19,
    borderWidth: 1,
  },
  editPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  iconBtn: {
    width: 38,
    height: 38,
    minWidth: 38,
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bentoCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
    minHeight: 124,
  },
  bentoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  bentoLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  bentoValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  bentoSubtext: {
    fontSize: 13,
    fontWeight: '500',
  },
  qtyMainRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 2,
  },
  qtyValueText: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },
  qtyUnitText: {
    fontSize: 15,
    fontWeight: '600',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  miniStepBtn: {
    width: 32,
    height: 32,
    minWidth: 32,
    minHeight: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  specRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  specLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  specLabel: {
    fontSize: 13,
  },
  specValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  notesBox: {
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
    marginTop: 2,
  },
  notesLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  notesContent: {
    fontSize: 13,
    lineHeight: 18,
  },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    marginTop: 4,
  },
  catalogIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catalogLinkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  actionToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
