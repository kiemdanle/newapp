import React, { useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecord, patchLocalRecord, deleteLocalRecord } from '../../../src/api/records';
import { useProduct, useCreateOrResumeDraft, usePatchDraft } from '../../../src/api/products';
import { uploadProductPhoto } from '../../../src/api/product-photo-upload';
import { useSessionStore } from '../../../src/auth/session-store';
import { useTheme } from '../../../src/theme/useTheme';
import { formatDate } from '../../../src/utils/country-format';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../../../src/features/records/expiryStatus';
import { QuickEditModal } from '../../../src/features/records/QuickEditModal';
import { ProductThumbnail } from '../../../src/components/ProductThumbnail';
import { Button } from '../../../src/components/Button';
import { MultiPhotoCameraModal } from '../../../src/components/MultiPhotoCameraModal';
import { choosePhotos, type PickedPhoto } from '../../../src/features/products/photo-picker-adapter';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
function getRelativeExpiryLabel(expiryDateStr: string, country?: string | null): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(`${expiryDateStr}T00:00:00Z`);
  const diffDays = Math.round((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `In ${diffDays} days`;
  return formatDate(expiryDateStr, country);
}
export default function RecordDetail() {
  const theme = useTheme();
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const navigation = useNavigation<AppNavigationProp>();
  const insets = useSafeAreaInsets();
  const { id } = useRoute().params as { id: string };
  const record = useRecord(id);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const { data: product } = useProduct(record?.productId ?? undefined);
  const [showEditModal, setShowEditModal] = useState(false);
  const createOrResumeDraft = useCreateOrResumeDraft();
  const patchDraft = usePatchDraft();

  React.useEffect(() => {
    const onBackPress = () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('Tabs');
      }
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [navigation]);
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
  const imageUrl = record.photoUrl || product?.imageUrl || (product?.photos && (product.photos[0]?.displayUrl || product.photos[0]?.thumbnailUrl)) || null;
  const barcode = product?.barcode;
  const description = product?.description;
  const shelfLife = product?.defaultShelfLifeDays;
  const catalogProductId = record.productId || product?.id;
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
  const savePhotoToRecord = async (photo: PickedPhoto) => {
    // 1. Immediately update local record for instant UI feedback
    await patchLocalRecord(record.id, { photoUrl: photo.path });

    // 2. If record is linked to a draft/pending product, upload photo directly
    if (product && (product.status === 'draft' || product.status === 'changes_required')) {
      try {
        const uploadHandle = uploadProductPhoto(
          { kind: 'draft', productId: product.id },
          { path: photo.path, mime: photo.mime },
        );
        await uploadHandle.promise;
      } catch {}
    } else if (!product && !record.productId) {
      // 3. If record is a custom item without product ID, create a private draft and upload photo to server
      try {
        const draftRes = await createOrResumeDraft.mutateAsync({
          barcode: barcode || null,
          qrPayload: null,
        });
        await patchDraft.mutateAsync({
          id: draftRes.product.id,
          version: draftRes.product.version,
          name: displayName,
          category: record.category || null,
        });
        const uploadHandle = uploadProductPhoto(
          { kind: 'draft', productId: draftRes.product.id },
          { path: photo.path, mime: photo.mime },
        );
        await uploadHandle.promise;
        await patchLocalRecord(record.id, { productId: draftRes.product.id });
      } catch {}
    }
  };

  const handleCameraCapture = async (photos: PickedPhoto[]) => {
    if (photos.length > 0 && photos[0]) {
      await savePhotoToRecord(photos[0]);
    }
  };

  const handlePickPhoto = () => {
    Alert.alert('Item Photo', 'Choose how you want to add a photo', [
      {
        text: 'Take Photo',
        onPress: () => {
          setShowCameraModal(true);
        },
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          try {
            const picked = await choosePhotos(1);
            if (picked.length > 0 && picked[0]) {
              await savePhotoToRecord(picked[0]);
            }
          } catch {}
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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

  const relativeExpiry = getRelativeExpiryLabel(record.expiryDate, userCountry);

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
        {/* Hero Photo / Add Photo Card */}
        {imageUrl || (product?.photos && product.photos.length > 0) ? (
          <View style={[styles.photoHeroWrap, { borderColor: theme.colors.border }]}>
            <ProductThumbnail
              product={product}
              photoUrl={record.photoUrl}
              style={styles.photoHero}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Change photo"
              onPress={handlePickPhoto}
              style={[styles.changePhotoFloatingBtn, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border }]}
            >
              <Ionicons name="camera-outline" size={15} color={theme.colors.text} />
              <Text style={[styles.changePhotoBtnText, { color: theme.colors.text }]}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add photo"
            onPress={handlePickPhoto}
            style={({ pressed }) => [
              styles.addPhotoDashedBox,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[styles.addPhotoIconBadge, { backgroundColor: theme.colors.primaryLight }]}>
              <Ionicons name="camera-outline" size={22} color={theme.colors.primaryDark} />
            </View>
            <Text style={[styles.addPhotoPromptText, { color: theme.colors.text }]}>Add item photo</Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 1 }}>
              Take a photo or choose from library
            </Text>
          </Pressable>
        )}

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
              {formatDate(record.expiryDate, userCountry)}
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

          {/* Catalog Link & Suggest Edit Rows */}
          {catalogProductId ? (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add another to pantry"
                onPress={() => navigation.navigate('Product', { id: catalogProductId })}
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
                  <Ionicons name="add-circle-outline" size={16} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catalogLinkText, { color: theme.colors.text }]}>
                    Add another to pantry
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 1 }}>
                    Log another item with a different expiry date
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Suggest edit for this product"
                testID="record-suggest-product-edit"
                onPress={() => navigation.navigate('ProductEdit', { id: catalogProductId })}
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
                  <Ionicons name="create-outline" size={16} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catalogLinkText, { color: theme.colors.text }]}>
                    Suggest edit for this product
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 1 }}>
                    Edit name, brand, category, shelf life or photos
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: 8, marginTop: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add to product catalog"
                testID="record-create-catalog-product"
                onPress={() =>
                  navigation.navigate('ProductNew', {
                    barcode: barcode || undefined,
                    target: 'pantry',
                  })
                }
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
                  <Ionicons name="cloud-upload-outline" size={16} color={theme.colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.catalogLinkText, { color: theme.colors.text }]}>
                    Add to Global Product Catalog
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 1 }}>
                    Publish details & photos for the community
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          )}
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
      <MultiPhotoCameraModal
        visible={showCameraModal}
        maxPhotos={1}
        title="Item Photo"
        onCapture={handleCameraCapture}
        onClose={() => setShowCameraModal(false)}
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
  changePhotoFloatingBtn: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  changePhotoBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addPhotoDashedBox: {
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addPhotoIconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  addPhotoPromptText: {
    fontSize: 14,
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
