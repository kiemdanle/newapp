// apps/mobile/src/features/deals/DealForm.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Deal } from '@expyrico/shared';
import { useCreateDeal, useDealStores, useUpdateDeal, uploadDealPhoto } from '../../api/deals';
import { takePhoto, choosePhotos } from '../products/photo-picker-adapter';
import { WheelDatePickerModal } from '../../components/WheelDatePickerModal';
import { useSessionStore } from '../../auth/session-store';
import { useTheme } from '../../theme/useTheme';
import { getCountryMetadata } from '../../utils/country-format';
interface Props {
  product: { id: string; name: string; brand?: string | null };
  existing?: Deal;
  onDone: () => void;
}

export function DealForm({ product, existing, onDone }: Props) {
  const theme = useTheme();
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const countryMeta = getCountryMetadata(userCountry);
  const currencySymbol = countryMeta.currencySymbol || '$';
  const currencyCode = countryMeta.currencyCode || 'USD';
  const storesQuery = useDealStores();
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [storeName, setStoreName] = useState(existing?.storeName ?? '');
  const [expiryDate, setExpiryDate] = useState(existing?.expiryDate ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [localPhoto, setLocalPhoto] = useState<{ path: string; mime?: string; uploadedUrl?: string } | null>(() =>
    existing?.photoUrl ? { path: existing.photoUrl, uploadedUrl: existing.photoUrl } : null,
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCreateDeal();
  const update = useUpdateDeal();
  const pending = create.isPending || update.isPending || uploadingPhoto;
  const availableStores = storesQuery.data?.items ?? [];


  async function handleTakePhoto() {
    try {
      const picked = await takePhoto();
      if (picked) {
        setLocalPhoto({ path: picked.path, mime: picked.mime });
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to capture photo');
    }
  }

  async function handleChooseGallery() {
    try {
      const pickedList = await choosePhotos(1);
      if (pickedList && pickedList.length > 0 && pickedList[0]) {
        setLocalPhoto({ path: pickedList[0].path, mime: pickedList[0].mime });
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Failed to select photo');
    }
  }

  function handleRemovePhoto() {
    setLocalPhoto(null);
  }
  async function submit() {
    setError(null);
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      setError('Please enter a valid price greater than $0.');
      return;
    }
    if (!storeName.trim()) {
      setError('Please enter or select a store name.');
      return;
    }

    const expiry = /^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ? expiryDate : undefined;

    try {
      let finalPhotoUrl = localPhoto?.uploadedUrl ?? null;
      if (localPhoto && !localPhoto.uploadedUrl) {
        setUploadingPhoto(true);
        try {
          const res = await uploadDealPhoto({ path: localPhoto.path, mime: localPhoto.mime });
          finalPhotoUrl = res.photoUrl;
        } catch {
          finalPhotoUrl = localPhoto.path;
        } finally {
          setUploadingPhoto(false);
        }
      }

      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          patch: {
            price: parsedPrice,
            storeName: storeName.trim(),
            expiryDate: expiry ?? null,
            note: note.trim() || null,
            photoUrl: finalPhotoUrl,
          },
        });
      } else {
        await create.mutateAsync({
          productId: product.id,
          price: parsedPrice,
          currency: currencyCode,
          storeName: storeName.trim(),
          expiryDate: expiry,
          note: note.trim() || undefined,
          photoUrl: finalPhotoUrl ?? undefined,
        });
      }
      onDone();
    } catch (err: unknown) {
      setUploadingPhoto(false);
      setError((err as Error).message || 'Could not save your deal. Please check inputs and try again.');
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {existing ? 'Edit Deal' : 'Post a Deal'}
        </Text>
        <View
          style={[
            styles.productBadge,
            { backgroundColor: theme.colors.primary + '18', borderColor: theme.colors.primary },
          ]}
        >
          <Text style={[styles.productBadgeText, { color: theme.colors.primaryDark }]}>
            🛒 {product.name}
            {product.brand ? ` · ${product.brand}` : ''}
          </Text>
        </View>
      </View>

      {/* Price Field */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
          Deal Price ({currencySymbol}) <Text style={{ color: theme.colors.danger }}>*</Text>
        </Text>
        <TextInput
          accessibilityLabel="price"
          placeholder={currencyCode === 'VND' ? 'e.g. 45000' : 'e.g. 2.99'}
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="decimal-pad"
          value={price}
          onChangeText={setPrice}
          editable={!pending}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        />
      </View>

      {/* Store Name Field + Autocomplete Chips */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
          Store Name <Text style={{ color: theme.colors.danger }}>*</Text>
        </Text>
        <TextInput
          accessibilityLabel="store"
          placeholder="Where did you find this deal?"
          placeholderTextColor={theme.colors.textMuted}
          value={storeName}
          onChangeText={setStoreName}
          editable={!pending}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        />
        {/* Popular Store Suggestions */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.storeChips}
        >
          {availableStores.slice(0, 7).map((s) => (
            <Pressable
              key={s.name}
              accessibilityRole="button"
              onPress={() => setStoreName(s.name)}
              style={[
                styles.storeChip,
                {
                  backgroundColor:
                    storeName.toLowerCase() === s.name.toLowerCase()
                      ? theme.colors.primary
                      : theme.colors.bgElevated,
                  borderColor:
                    storeName.toLowerCase() === s.name.toLowerCase()
                      ? theme.colors.primary
                      : theme.colors.border,
                  borderRadius: theme.radii.pill,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color:
                    storeName.toLowerCase() === s.name.toLowerCase()
                      ? theme.colors.primaryFg
                      : theme.colors.text,
                }}
              >
                {s.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Expiry Date Field with Modal Trigger */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
          Expiry / Best-By Date (Optional)
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select expiration date"
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.datePickerTrigger,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <Text
            style={{
              color: expiryDate ? theme.colors.text : theme.colors.textMuted,
              fontSize: 15,
            }}
          >
            {expiryDate ? `🗓️ ${expiryDate}` : 'Tap to select expiration date…'}
          </Text>
          {expiryDate ? (
            <Pressable
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation();
                setExpiryDate('');
              }}
            >
              <Text style={{ color: theme.colors.textMuted, fontWeight: '700' }}>✕</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </View>

      {/* Proof Photo Section (Camera & Gallery) */}
      <View style={styles.fieldGroup}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
            Proof Photo (Receipt or Shelf Tag)
          </Text>
          {localPhoto ? (
            <Text style={[styles.photoStatusText, { color: theme.colors.primaryDark }]}>
              ✓ Photo added
            </Text>
          ) : null}
        </View>

        {localPhoto ? (
          <View
            style={[
              styles.photoPreviewCard,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
              },
            ]}
          >
            <Image
              source={{ uri: localPhoto.path }}
              style={styles.photoPreviewImage}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
            <View style={[styles.photoCoverBadge, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.photoCoverText, { color: theme.colors.primaryFg }]}>Proof Photo</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Remove proof photo"
              onPress={handleRemovePhoto}
              style={[styles.photoRemoveBtn, { backgroundColor: 'rgba(0,0,0,0.65)' }]}
            >
              <Ionicons name="close" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        ) : (
          <View style={styles.photoActionsRow}>
            <Pressable
              testID="deal-photo-camera-btn"
              accessibilityRole="button"
              accessibilityLabel="Take a photo with camera"
              onPress={handleTakePhoto}
              style={[
                styles.addPhotoBtn,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <Ionicons name="camera-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.addPhotoText, { color: theme.colors.text }]}>Camera</Text>
            </Pressable>

            <Pressable
              testID="deal-photo-gallery-btn"
              accessibilityRole="button"
              accessibilityLabel="Select photo from gallery"
              onPress={handleChooseGallery}
              style={[
                styles.addPhotoBtn,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              <Ionicons name="images-outline" size={24} color={theme.colors.primary} />
              <Text style={[styles.addPhotoText, { color: theme.colors.text }]}>Gallery</Text>
            </Pressable>
          </View>
        )}
        <Text style={[styles.photoHintText, { color: theme.colors.textMuted }]}>
          💡 Take a clear photo of the price tag or receipt to help neighbors verify the discount.
        </Text>
      </View>

      {/* Notes / Special Deal Details */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
          Additional Note (Optional)
        </Text>
        <TextInput
          accessibilityLabel="note"
          placeholder="e.g. Clearance section markdown, Buy 1 Get 1 free, etc."
          placeholderTextColor={theme.colors.textMuted}
          value={note}
          onChangeText={setNote}
          multiline
          editable={!pending}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              minHeight: 88,
              textAlignVertical: 'top',
            },
          ]}
        />
      </View>

      {error ? (
        <View style={[styles.errorBox, { backgroundColor: theme.colors.danger + '18' }]}>
          <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text>
        </View>
      ) : null}

      {/* Submit Action */}
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={submit}
        style={[
          styles.submitBtn,
          {
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radii.pill,
            opacity: pending ? 0.7 : 1,
          },
        ]}
      >
        {pending ? (
          <ActivityIndicator color={theme.colors.primaryFg} />
        ) : (
          <Text style={[styles.submitText, { color: theme.colors.primaryFg }]}>
            {existing ? 'Save Changes' : 'Post Deal to Community'}
          </Text>
        )}
      </Pressable>

      {/* Wheel Date Picker Modal */}
      <WheelDatePickerModal
        visible={showDatePicker}
        value={expiryDate}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(isoDate) => setExpiryDate(isoDate)}
        title="Select Deal Expiry Date"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 60,
  },
  header: {
    gap: 8,
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  productBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
  },
  productBadgeText: {
    fontSize: 14,
    fontWeight: '700',
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  storeChips: {
    gap: 6,
    paddingTop: 6,
  },
  storeChip: {
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  datePickerTrigger: {
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    minHeight: 48,
  },
  errorBox: {
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  photoStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  photoActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addPhotoBtn: {
    flex: 1,
    height: 76,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addPhotoText: {
    fontSize: 13,
    fontWeight: '700',
  },
  photoHintText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  photoPreviewCard: {
    width: '100%',
    height: 180,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreviewImage: {
    width: '100%',
    height: '100%',
  },
  photoCoverBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  photoCoverText: {
    fontSize: 11,
    fontWeight: '700',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
