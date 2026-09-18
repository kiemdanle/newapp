import React, { useEffect, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  BackHandler,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRecordWithStatus, patchLocalRecord, saveRecordPhotos, deleteLocalRecord, markRecordStatusWithQuantity, restoreLocalRecord, uploadRecordPhoto, type LocalRecord } from '../../../src/api/records';
import { useMyHouseholds } from '../../../src/api/households';
import { useImageSettlementTracker } from '../../../src/cache/useImageSettlementTracker';
import { RecordDetailSkeleton } from '../../../src/components/skeleton';
import { useActiveGiveawaysForRecord } from '../../../src/api/giveaways';
import { useUndoToastStore } from '../../../src/store/undoToast';
import { QuantityPromptModal } from '../../../src/components/QuantityPromptModal';
import { DiscardReasonModal } from '../../../src/components/DiscardReasonModal';
import { PhotoSourcePickerModal } from '../../../src/components/PhotoSourcePickerModal';
import { DeletePhotoConfirmModal } from '../../../src/components/DeletePhotoConfirmModal';
import { PhotoLimitModal } from '../../../src/components/PhotoLimitModal';
import type { Household } from '@expyrico/shared';
import { useProduct } from '../../../src/api/products';
import { useSessionStore } from '../../../src/auth/session-store';
import { useTheme } from '../../../src/theme/useTheme';
import { formatDate } from '../../../src/utils/country-format';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../../../src/features/records/expiryStatus';
import { QuickEditModal } from '../../../src/features/records/QuickEditModal';
import { Button } from '../../../src/components/Button';
import { MultiPhotoCameraModal } from '../../../src/components/MultiPhotoCameraModal';
import { choosePhotos, handlePhotoPickerError, type PickedPhoto } from '../../../src/features/products/photo-picker-adapter';
import { usePhotoLimits } from '../../../src/utils/photo-limits';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import { ItemImageGallery } from '../../../src/components/ItemImageGallery';
import { ProductReviewsSection } from '../../../src/features/reviews/ProductReviewsSection';
import { ProductReviewSummaryCard } from '../../../src/features/reviews/ProductReviewSummaryCard';
import { BackToTopButton, useBackToTop } from '../../../src/components/BackToTopButton';
export function getRelativeExpiryLabel(
  expiryDateStr: string,
  country?: string | null,
  now: Date = new Date(),
): string {
  if (!expiryDateStr) return '';
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const exp = new Date(`${expiryDateStr}T00:00:00Z`);
  const diffDays = Math.round((exp.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  if (Number.isNaN(diffDays)) return formatDate(expiryDateStr, country);
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Expires today';
  if (diffDays === 1) return 'Tomorrow';
  return `In ${diffDays} days`;
}
export default function RecordDetail() {
  const theme = useTheme();
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const navigation = useNavigation<AppNavigationProp>();
  const insets = useSafeAreaInsets();
  const { id = '' } = (useRoute().params ?? {}) as { id?: string };
  const {
    record,
    isResolved: isRecordResolved,
    isError: isRecordError,
    errorMessage: recordErrorMessage,
    retry: retryRecord,
  } = useRecordWithStatus(id);
  const { data: product, isLoading: isProductLoading, isError: isProductError } = useProduct(record?.productId ?? undefined);
  const catalogProductId = record?.productId || product?.id;
  const [pendingReplaceIndex, setPendingReplaceIndex] = useState<number | null>(null);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [photoSourceModal, setPhotoSourceModal] = useState<{
    visible: boolean;
    mode: 'cover' | 'add' | 'replace';
    index: number;
  }>({ visible: false, mode: 'add', index: 0 });
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [photoSaveState, setPhotoSaveState] = useState<'idle' | 'uploading' | 'saving' | 'error'>('idle');
  const [pendingPhotos, setPendingPhotos] = useState<string[] | null>(null);
  const scrollRef = React.useRef<ScrollView>(null);

  const {
    visible: showBackToTop,
    handleScroll,
    scrollToTop: handleScrollToTop,
    onTouchStart: handleTouchActivity,
  } = useBackToTop({
    scrollRef,
    hasTabBar: false,
    offsetBottom: 84,
    threshold: 280,
    autoHideTimeout: 2500,
  });
  const photoSaveInFlight = React.useRef(false);
  const photoSaveAttempt = React.useRef<{ urls: string[]; photos: PickedPhoto[] } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState('');
  const isSavingPhotos = photoSaveState === 'uploading' || photoSaveState === 'saving';
  const { maxPantryItemPhotos } = usePhotoLimits();
  const { data: householdsData } = useMyHouseholds();
  const households = householdsData?.items ?? [];
  const { data: activeGiveaways } = useActiveGiveawaysForRecord(record?.id, record?.serverId);
  const [pendingStatus, setPendingStatus] = useState<'consumed' | 'discarded' | null>(null);
  const [pendingQuantity, setPendingQuantity] = useState<number>(1);
  const [showQuantityModal, setShowQuantityModal] = useState(false);
  const [showDiscardReasonModal, setShowDiscardReasonModal] = useState(false);
  const handleReassignScope = async (newHouseholdId: string | null) => {
    if (!record) return;
    await patchLocalRecord(record.id, { householdId: newHouseholdId });
  };

  React.useEffect(() => {
    const onBackPress = () => {
      if (photoSaveInFlight.current) return true;
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
  const userPhotos = React.useMemo(() => {
    if (!record) return [];
    if (Array.isArray(record.localPhotos) && record.localPhotos.length > 0) {
      return record.localPhotos;
    }
    if (record.photoUrl) {
      return [record.photoUrl];
    }
    return [];
  }, [record]);

  const productPhotos = React.useMemo(() => {
    if (!product) return [];
    const list = [
      product.imageUrl,
      ...(product.photos?.map((p) => p.displayUrl || p.thumbnailUrl) || []),
    ].filter(Boolean) as string[];
    return Array.from(new Set(list));
  }, [product]);

  const hasUserPhotos = userPhotos.length > 0;
  const isProductFallback = !hasUserPhotos && productPhotos.length > 0;

  const savedPhotos = React.useMemo(() => {
    if (hasUserPhotos) {
      // Compose custom user photos first, followed by catalog product photos as reference
      if (productPhotos.length > 0) {
        return Array.from(new Set([...userPhotos, ...productPhotos]));
      }
      return userPhotos;
    }
    if (productPhotos.length > 0) return productPhotos;
    return [];
  }, [hasUserPhotos, userPhotos, productPhotos]);
  const displayedPhotos = pendingPhotos ?? savedPhotos;

  const { allSettled: allVisibleImagesSettled, markSettled } = useImageSettlementTracker(displayedPhotos);
  const [initialOverlayActive, setInitialOverlayActive] = useState(true);

  useEffect(() => {
    if (allVisibleImagesSettled) {
      setInitialOverlayActive(false);
    }
  }, [allVisibleImagesSettled]);
  if (isRecordError) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.bgGlass }]}>
          <Ionicons name="cloud-offline-outline" size={32} color={theme.colors.warning} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Unable to load item</Text>
        <Text style={[styles.emptySubcopy, { color: theme.colors.textMuted }]}>
          {recordErrorMessage || "We couldn't connect to your stash to load this item. Please check your network and try again."}
        </Text>
        <Button label="Retry" onPress={retryRecord} style={{ marginBottom: 12 }} />
        <Button label="Back to stash" variant="outline" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  if (!isRecordResolved) {
    return <RecordDetailSkeleton />;
  }

  if (!record) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.bg }]}>
        <View style={[styles.emptyIconWrap, { backgroundColor: theme.colors.bgGlass }]}>
          <Ionicons name="file-tray-outline" size={32} color={theme.colors.textMuted} />
        </View>
        <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Item not found</Text>
        <Text style={[styles.emptySubcopy, { color: theme.colors.textMuted }]}>
          This record may have been removed from your stash.
        </Text>
        <Button label="Back to stash" onPress={() => navigation.goBack()} />
      </View>
    );
  }
  if (record.productId && isProductLoading && !product && !isProductError) {
    return <RecordDetailSkeleton />;
  }

  const displayName = record.customName || product?.name || 'Stash Item';
  const brand = record.brand || product?.brand;
  const category = record.category || product?.category;
  const barcode = product?.barcode;
  const description = product?.description;
  const shelfLife = product?.defaultShelfLifeDays;
  const handleInitiateMark = (status: 'consumed' | 'discarded') => {
    if (activeGiveaways && activeGiveaways.length > 0) {
      Alert.alert(
        'Item Listed in Giveaway',
        'This stash item is currently offered in a community giveaway. Please cancel the giveaway before marking it as used or discarded.',
        [{ text: 'OK', style: 'default' }],
      );
      return;
    }

    if (record.quantity > 1) {
      setPendingStatus(status);
      setShowQuantityModal(true);
    } else if (status === 'discarded') {
      setPendingStatus('discarded');
      setPendingQuantity(1);
      setShowDiscardReasonModal(true);
    } else {
      void executeMark('consumed', 1, null);
    }
  };

  const executeMark = async (
    status: 'consumed' | 'discarded',
    quantity: number,
    reason: string | null = null,
  ) => {
    const result = await markRecordStatusWithQuantity(record.id, status, quantity, reason);
    useUndoToastStore.getState().show({
      recordId: result.affectedId,
      parentId: result.parentId,
      isSplit: result.isSplit,
      quantity: result.markedQuantity,
      unit: record.unit,
      itemName: displayName,
      status,
      discardReason: reason,
    });
    navigation.goBack();
  };

  const handleConfirmQuantity = (selectedQty: number) => {
    setShowQuantityModal(false);
    if (pendingStatus === 'discarded') {
      setPendingQuantity(selectedQty);
      setShowDiscardReasonModal(true);
    } else if (pendingStatus === 'consumed') {
      void executeMark('consumed', selectedQty, null);
    }
  };

  const handleSelectDiscardReason = (reason: string) => {
    setShowDiscardReasonModal(false);
    void executeMark('discarded', pendingQuantity, reason);
  };

  const handleRestore = async () => {
    const accessibleHouseholdIds = householdsData?.items?.map((h) => h.id) ?? [];
    const result = await restoreLocalRecord(record.id, accessibleHouseholdIds);
    if (result.wasReassignedToPersonal) {
      Alert.alert(
        'Restored to Personal Stash',
        'Your previous household is no longer accessible, so this item was restored to your personal stash.',
        [{ text: 'OK' }],
      );
    }
    navigation.goBack();
  };

  const remove = () => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${displayName}"? It will be removed from your stash.`,
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
  const persistPhotos = async (attempt: { urls: string[]; photos: PickedPhoto[] }) => {
    if (photoSaveInFlight.current) return;
    photoSaveInFlight.current = true;
    const userId = useSessionStore.getState().user?.id;
    photoSaveAttempt.current = attempt;
    setPendingPhotos([...attempt.urls]);
    setPhotoSaveState('uploading');
    setUploadProgress(0.12);
    setUploadStatusText('Uploading photo…');

    const totalLocal = attempt.urls.filter((u) => !u.startsWith('http://') && !u.startsWith('https://')).length;
    let uploadedSoFar = 0;

    try {
      for (const [index, uri] of attempt.urls.entries()) {
        if (uri.startsWith('https://') || uri.startsWith('http://')) continue;
        const photo = attempt.photos.find((candidate) => candidate.path === uri);
        const uploaded = await uploadRecordPhoto({ path: uri, mime: photo?.mime });
        if (useSessionStore.getState().user?.id !== userId) throw new Error('Session changed during upload');
        attempt.urls[index] = uploaded.photoUrl;
        uploadedSoFar++;
        const ratio = totalLocal > 0 ? 0.12 + (0.58 * (uploadedSoFar / totalLocal)) : 0.7;
        setUploadProgress(ratio);
        if (totalLocal > 1) {
          setUploadStatusText(`Uploading photo (${uploadedSoFar}/${totalLocal})…`);
        }
      }
      setPhotoSaveState('saving');
      setUploadProgress(0.85);
      setUploadStatusText('Saving to stash…');
      if (useSessionStore.getState().user?.id !== userId) throw new Error('Session changed during upload');
      await saveRecordPhotos(record.id, attempt.urls);
      photoSaveAttempt.current = null;
      setPendingPhotos(null);
      setPhotoSaveState('idle');
      setUploadProgress(0);
      setUploadStatusText('');
    } catch (err) {
      console.error('[persistPhotos] Error saving photos:', err);
      setPhotoSaveState('error');
    } finally {
      photoSaveInFlight.current = false;
    }
  };

  const savePhotosToRecord = async (newPhotos: PickedPhoto[]) => {
    const baseUrls = isProductFallback ? [] : userPhotos;
    const availableSlots = Math.max(0, maxPantryItemPhotos - baseUrls.length);
    const acceptedPhotos = newPhotos.slice(0, availableSlots);
    if (acceptedPhotos.length === 0) return;
    await persistPhotos({
      urls: [...baseUrls, ...acceptedPhotos.map((photo) => photo.path)],
      photos: acceptedPhotos,
    });
  };

  const replacePhotoAt = async (index: number, newPhoto: PickedPhoto) => {
    if (isProductFallback) {
      await savePhotosToRecord([newPhoto]);
      return;
    }
    const updated = [...userPhotos];
    updated[index] = newPhoto.path;
    await persistPhotos({ urls: updated, photos: [newPhoto] });
  };
  const handleCameraCapture = async (photos: PickedPhoto[]) => {
    const firstPhoto = photos[0];
    if (!firstPhoto) return;
    if (pendingReplaceIndex !== null) {
      await replacePhotoAt(pendingReplaceIndex, firstPhoto);
      setPendingReplaceIndex(null);
    } else {
      await savePhotosToRecord(photos);
    }
  };
  const handleChangeCover = (index: number = 0) => {
    if (isProductFallback || index >= userPhotos.length) {
      handleAddPhoto();
      return;
    }
    setPhotoSourceModal({
      visible: true,
      mode: index === 0 ? 'cover' : 'replace',
      index,
    });
  };

  const handleSetCover = async (index: number) => {
    if (isProductFallback || index >= userPhotos.length) return;
    if (index <= 0 || index >= displayedPhotos.length) return;
    const targetPhoto = displayedPhotos[index];
    if (!targetPhoto) return;
    const reordered: string[] = [targetPhoto, ...userPhotos.filter((_, i) => i !== index)];
    await persistPhotos({ urls: reordered, photos: [] });
  };

  const handleAddPhoto = () => {
    if (displayedPhotos.length >= maxPantryItemPhotos) {
      setShowLimitModal(true);
      return;
    }
    setPhotoSourceModal({
      visible: true,
      mode: 'add',
      index: 0,
    });
  };

  const handlePickPhoto = () => handleChangeCover(0);

  const isPhotoDeletableByIndex = (index: number) => {
    if (isProductFallback) return false;
    return index < userPhotos.length;
  };

  const handleDeletePhoto = (index: number) => {
    if (!isPhotoDeletableByIndex(index)) return;
    setDeleteTargetIndex(index);
  };

  const executeDeletePhoto = async () => {
    if (deleteTargetIndex === null || deleteTargetIndex < 0 || !isPhotoDeletableByIndex(deleteTargetIndex)) return;
    const idx = deleteTargetIndex;
    setDeleteTargetIndex(null);
    const updatedUserPhotos = userPhotos.filter((_, i) => i !== idx);
    await persistPhotos({ urls: updatedUserPhotos, photos: [] });
  };
  const handleChooseGalleryFromModal = async () => {
    if (photoSourceModal.mode === 'add') {
      try {
        const baseLength = isProductFallback ? 0 : userPhotos.length;
        const remaining = Math.max(0, maxPantryItemPhotos - baseLength);
        if (remaining <= 0) return;
        const picked = await choosePhotos(remaining);
        if (picked.length > 0) {
          await savePhotosToRecord(picked);
        }
      } catch (err) {
        handlePhotoPickerError(err, 'gallery');
      }
    } else {
      try {
        const picked = await choosePhotos(1);
        if (picked.length > 0 && picked[0]) {
          await replacePhotoAt(photoSourceModal.index, picked[0]);
        }
      } catch (err) {
        handlePhotoPickerError(err, 'gallery');
      }
    }
  };
  const handleSaveQuickEdit = async (patch: {
    customName?: string | null;
    brand?: string | null;
    category?: string | null;
    quantity: number;
    unit: string;
    expiryDate: string;
    location?: string | null;
    householdId?: string | null;
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
        ref={scrollRef}
        onScroll={handleScroll}
        onTouchStart={handleTouchActivity}
        scrollEventThrottle={16}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 34) + 90,
          gap: 14,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={true}
      >
        {/* Hero Photo / Add Photo Card */}
        <View pointerEvents={photoSaveState !== 'idle' ? 'none' : 'auto'}>
        {displayedPhotos.length > 0 ? (
          <ItemImageGallery
            photos={displayedPhotos}
            title={displayName || 'Pantry Item'}
            placeholderIcon="basket-outline"
            placeholderText="No photo attached"
            onAddPhoto={handleAddPhoto}
            onDeletePhoto={handleDeletePhoto}
            isPhotoDeletable={isPhotoDeletableByIndex}
            isProductFallback={isProductFallback}
            onChangeCover={isProductFallback ? undefined : handleChangeCover}
            onSetCover={isProductFallback ? undefined : handleSetCover}
            onImageSettled={markSettled}
            maxPhotos={maxPantryItemPhotos}
            uploadStatus={{
              isUploading: photoSaveState === 'uploading' || photoSaveState === 'saving',
              progress: uploadProgress,
              statusText: uploadStatusText,
            }}
            floatingAction={
              isProductFallback
                ? {
                    icon: 'camera-outline',
                    label: 'Add photo',
                    onPress: handleAddPhoto,
                    accessibilityLabel: 'Add photo for this item',
                  }
                : {
                    icon: 'camera-outline',
                    label: 'Change',
                    onPress: () => handleChangeCover(0),
                    accessibilityLabel: 'Change photo',
                  }
            }
          />
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
        </View>
        {photoSaveState === 'error' && (
          <View accessibilityRole="alert" style={{ padding: theme.spacing.xl, gap: theme.spacing.md, backgroundColor: theme.colors.bgElevated }}>
            <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Photos not saved</Text>
            <Text style={{ color: theme.colors.text }}>The server has not confirmed your photos. Retry before leaving this item or signing out.</Text>
            <Button label="Retry upload" onPress={() => {
              if (photoSaveAttempt.current) void persistPhotos(photoSaveAttempt.current);
            }} />
            <Button label="Discard photo changes" variant="outline" onPress={() => {
              photoSaveAttempt.current = null;
              setPendingPhotos(null);
              setPhotoSaveState('idle');
            }} />
          </View>
        )}

        {/* Historical Status Banner for non-active items */}
        {record.status !== 'active' && (
          <View
            testID="record-historical-status-banner"
            style={[
              styles.historicalBanner,
              {
                backgroundColor:
                  record.status === 'consumed'
                    ? 'rgba(75, 174, 138, 0.12)'
                    : 'rgba(245, 166, 35, 0.12)',
                borderColor:
                  record.status === 'consumed' ? theme.colors.primary : theme.colors.accent,
              },
            ]}
          >
            <Ionicons
              name={record.status === 'consumed' ? 'checkmark-circle' : 'trash'}
              size={22}
              color={record.status === 'consumed' ? theme.colors.primary : theme.colors.accent}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.historicalBannerTitle, { color: theme.colors.text }]}>
                {record.status === 'consumed' ? 'Marked as Used' : 'Marked as Discarded'}
              </Text>
              <Text style={[styles.historicalBannerSubtitle, { color: theme.colors.textMuted }]}>
                {record.status === 'consumed'
                  ? `Consumed${record.consumedAt ? ` on ${formatDate(record.consumedAt.slice(0, 10), userCountry)}` : ''}`
                  : `Discarded${record.discardedAt ? ` on ${formatDate(record.discardedAt.slice(0, 10), userCountry)}` : ''}${record.discardReason ? ` · Reason: ${record.discardReason.charAt(0).toUpperCase() + record.discardReason.slice(1)}` : ''}`}
              </Text>
            </View>
          </View>
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
            {catalogProductId ? (
              <ProductReviewSummaryCard
                productId={catalogProductId}
                product={product}
                onPressViewReviews={() => {
                  if (catalogProductId) {
                    navigation.navigate('ProductReviews', { id: catalogProductId });
                  }
                }}
                onPressWriteReview={() => {
                  if (catalogProductId) {
                    navigation.navigate('ProductReview', { id: catalogProductId });
                  }
                }}
              />
            ) : null}
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
          <RecordLocationRow
            record={record}
            households={households}
            onReassign={handleReassignScope}
          />


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
                accessibilityLabel="Add another to stash"
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
                    Add another to stash
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
                accessibilityLabel="Add to product catalogue"
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
                    Add to Global Product Catalogue
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
          {product ? (
            <ProductReviewsSection product={product} />
          ) : null}
      </ScrollView>


      {/* Floating Bottom Action Toolbar */}
      <View
        style={[
          styles.actionToolbar,
          {
            backgroundColor: theme.colors.bgElevated,
            borderTopColor: theme.colors.border,
            paddingBottom: Math.max(insets.bottom, 34),
          },
        ]}
      >
        {record.status !== 'active' ? (
          <Button
            testID="record-restore-pantry-btn"
            label="Restore to Stash"
            icon="refresh-outline"
            variant="primary"
            onPress={handleRestore}
          />
        ) : (
          <View style={styles.actionRow}>
            <View style={{ flex: 1 }}>
              <Button
                testID="record-mark-consumed"
                label="Mark as used"
                icon="checkmark-circle-outline"
                variant="primary"
                onPress={() => handleInitiateMark('consumed')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                testID="record-mark-discarded"
                label="Mark as discarded"
                icon="trash-outline"
                variant="outline"
                onPress={() => handleInitiateMark('discarded')}
              />
            </View>
          </View>
        )}
      </View>

      <BackToTopButton
        scrollRef={scrollRef}
        visible={showBackToTop}
        onPress={handleScrollToTop}
        hasTabBar={false}
        offsetBottom={84}
        testID="record-detail-back-to-top"
      />
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
        maxPhotos={Math.max(1, maxPantryItemPhotos - displayedPhotos.length)}
        title="Item Photos"
        onCapture={handleCameraCapture}
        onClose={() => setShowCameraModal(false)}
      />
      <QuantityPromptModal
        visible={showQuantityModal}
        itemName={displayName}
        maxQuantity={record.quantity}
        unit={record.unit}
        actionType={pendingStatus || 'consumed'}
        onClose={() => setShowQuantityModal(false)}
        onConfirm={handleConfirmQuantity}
      />
      <DiscardReasonModal
        visible={showDiscardReasonModal}
        itemName={displayName}
        onClose={() => setShowDiscardReasonModal(false)}
        onSelectReason={handleSelectDiscardReason}
      />
      {/* Bespoke Photo Source Picker Bottom Sheet */}
      <PhotoSourcePickerModal
        visible={photoSourceModal.visible}
        title={
          photoSourceModal.mode === 'cover'
            ? 'Change Cover Photo'
            : photoSourceModal.mode === 'replace'
              ? 'Replace Photo'
              : 'Add Item Photo'
        }
        subtitle={
          photoSourceModal.mode === 'cover'
            ? 'Select a new photo to represent this stash item'
            : photoSourceModal.mode === 'replace'
              ? 'Update this photo with a new capture or upload'
              : 'Snap or choose photos to attach to this item (up to 5)'
        }
        onClose={() => setPhotoSourceModal((prev) => ({ ...prev, visible: false }))}
        onTakePhoto={() => {
          setPendingReplaceIndex(photoSourceModal.mode === 'add' ? null : photoSourceModal.index);
          setShowCameraModal(true);
        }}
        onChooseGallery={handleChooseGalleryFromModal}
      />

      {/* Bespoke Delete Photo Confirmation Modal */}
      <DeletePhotoConfirmModal
        visible={deleteTargetIndex !== null}
        onClose={() => setDeleteTargetIndex(null)}
        onConfirmDelete={executeDeletePhoto}
      />

      {/* Photo Limit Reached Modal */}
      <PhotoLimitModal
        visible={showLimitModal}
        maxPhotos={maxPantryItemPhotos}
        onClose={() => setShowLimitModal(false)}
      />
      {initialOverlayActive && !allVisibleImagesSettled && (
        <RecordDetailSkeleton
          style={StyleSheet.absoluteFillObject}
          pointerEvents="auto"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  historicalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  historicalBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  historicalBannerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalSubcopy: {
    fontSize: 13,
    marginBottom: 4,
  },
  reassignOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  reassignOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  reassignCancelBtn: {
    marginTop: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  reassignCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export function RecordLocationRow({
  record,
  households,
  onReassign,
}: {
  record: LocalRecord;
  households: Household[];
  onReassign: (newHouseholdId: string | null) => Promise<void>;
}) {
  const theme = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const currentUserId = useSessionStore((s) => s.user?.id ?? null);
  const isCreator = !record.userId || !currentUserId || record.userId === currentUserId;
  const canMoveToPersonal = !record.householdId || isCreator;

  const currentHousehold = households.find((h) => h.id === record.householdId);
  const locationLabel = currentHousehold ? currentHousehold.name : 'Personal Stash';

  return (
    <>
      <View style={styles.specRow}>
        <View style={styles.specLabelWrap}>
          <Ionicons
            name={record.householdId ? 'people-outline' : 'person-outline'}
            size={15}
            color={theme.colors.textMuted}
          />
          <Text style={[styles.specLabel, { color: theme.colors.textMuted }]}>Stash Location</Text>
        </View>
        <Pressable
          testID="record-reassign-scope-btn"
          disabled={households.length === 0}
          accessibilityRole="button"
          accessibilityLabel={`Change stash location, currently ${locationLabel}`}
          onPress={() => setModalVisible(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text
            testID="record-location-label"
            style={[
              styles.specValue,
              {
                color: households.length > 0 ? theme.colors.primaryDark : theme.colors.text,
              },
            ]}
          >
            {locationLabel}
          </Text>
          {households.length > 0 && (
            <Ionicons name="chevron-forward" size={14} color={theme.colors.primaryDark} />
          )}
        </Pressable>
      </View>

      {/* Scope Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          testID="reassign-modal-backdrop"
          accessibilityRole="button"
          accessibilityLabel="Dismiss stash move dialogue"
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            testID="reassign-modal-card"
            accessibilityRole="none"
            accessible={false}
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Move Stash Item
            </Text>
            <Text style={[styles.modalSubcopy, { color: theme.colors.textMuted }]}>
              Choose where this item is stored
            </Text>

            <View style={{ gap: 8, marginTop: 8 }}>
              {/* Personal Pantry Option — creator only */}
              {canMoveToPersonal ? (
              <Pressable
                testID="reassign-option-personal"
                accessibilityRole="button"
                accessibilityLabel="Move to Personal Stash"
                onPress={async () => {
                  setModalVisible(false);
                  await onReassign(null);
                }}
                style={({ pressed }) => [
                  styles.reassignOption,
                  {
                    backgroundColor:
                      record.householdId === null
                        ? theme.colors.primaryLight
                        : theme.colors.bg,
                    borderColor:
                      record.householdId === null
                        ? theme.colors.primary
                        : theme.colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={
                      record.householdId === null
                        ? theme.colors.primaryDark
                        : theme.colors.textMuted
                    }
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.reassignOptionTitle,
                        {
                          color:
                            record.householdId === null
                              ? theme.colors.primaryDark
                              : theme.colors.text,
                        },
                      ]}
                    >
                      Personal Stash
                    </Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                      Only you can see and manage this item
                    </Text>
                  </View>
                </View>
                {record.householdId === null && (
                  <Ionicons name="checkmark-circle" size={18} color={theme.colors.primaryDark} />
                )}
              </Pressable>
              ) : null}

              {/* Household Options */}
              {households.map((h) => {
                const selected = record.householdId === h.id;
                return (
                  <Pressable
                    key={h.id}
                    testID={`reassign-option-${h.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Move to ${h.name}`}
                    onPress={async () => {
                      setModalVisible(false);
                      await onReassign(h.id);
                    }}
                    style={({ pressed }) => [
                      styles.reassignOption,
                      {
                        backgroundColor: selected
                          ? theme.colors.primaryLight
                          : theme.colors.bg,
                        borderColor: selected
                          ? theme.colors.primary
                          : theme.colors.border,
                        opacity: pressed ? 0.8 : 1,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <Ionicons
                        name="people-outline"
                        size={20}
                        color={selected ? theme.colors.primaryDark : theme.colors.textMuted}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[
                            styles.reassignOptionTitle,
                            {
                              color: selected
                                ? theme.colors.primaryDark
                                : theme.colors.text,
                            },
                          ]}
                        >
                          {h.name}
                        </Text>
                        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                          Shared with household members
                        </Text>
                      </View>
                    </View>
                    {selected && (
                      <Ionicons name="checkmark-circle" size={18} color={theme.colors.primaryDark} />
                    )}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              testID="reassign-modal-cancel"
              accessibilityRole="button"
              accessibilityLabel="Cancel moving item"
              onPress={() => setModalVisible(false)}
              style={({ pressed }) => [
                styles.reassignCancelBtn,
                {
                  borderColor: theme.colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text style={[styles.reassignCancelText, { color: theme.colors.textMuted }]}>
                Cancel
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

