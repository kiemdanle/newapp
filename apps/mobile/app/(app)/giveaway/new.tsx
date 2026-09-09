// apps/mobile/app/(app)/giveaway/new.tsx
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from '@/components/KeyboardAwareScrollView';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useCreateGiveaway, uploadGiveawayPhoto } from '@/api/giveaways';
import { choosePhotos, handlePhotoPickerError, type PickedPhoto } from '@/features/products/photo-picker-adapter';
import { WheelDatePickerModal } from '@/components/WheelDatePickerModal';
import { MultiPhotoCameraModal } from '@/components/MultiPhotoCameraModal';
import { Button } from '@/components/Button';
import { useSessionStore } from '@/auth/session-store';
import { useTheme } from '@/theme/useTheme';
import { formatDate } from '@/utils/country-format';
import type { AppNavigationProp } from '@/navigation/AppNavigator';
import type { LocalRecord } from '@/api/records';
import type { Product } from '@expyrico/shared';
import { PantrySelectModal } from '@/features/giveaways/PantrySelectModal';

const MAX_PHOTOS = 5;
const COMMON_UNITS = ['pcs', 'pack', 'can', 'bottle', 'kg', 'box'] as const;
const DATE_PRESETS = [
  { label: '+3d', days: 3 },
  { label: '+1w', days: 7 },
  { label: '+2w', days: 14 },
  { label: '+1m', days: 30 },
] as const;

interface LocalPhotoItem {
  id: string;
  path: string;
  mime?: string;
  uploading?: boolean;
  uploadedUrl?: string;
}

export default function NewGiveawayScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const user = useSessionStore((s) => s.user);
  const userCountry = user?.country ?? null;
  const profileLocation = user?.address?.trim() ?? '';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocation] = useState(profileLocation);
  const [expiryDate, setExpiryDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [photos, setPhotos] = useState<LocalPhotoItem[]>([]);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPantryModal, setShowPantryModal] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState<string>('pcs');
  const [maxAvailableQty, setMaxAvailableQty] = useState<number | null>(null);
  const [linkedPantryName, setLinkedPantryName] = useState<string | null>(null);
  const create = useCreateGiveaway();
  const pending = create.isPending || uploadingPhotos;
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const handleSetFocusedField = (field: 'title' | 'unit' | 'location' | 'description' | null) => {
    setFocusedField(field);
  };

  const getFieldBorderColor = (fieldKey: string) =>
    focusedField === fieldKey ? theme.colors.primary : theme.colors.border;

  function handleCameraCapture(pickedList: PickedPhoto[]) {
    if (pickedList && pickedList.length > 0) {
      const newItems: LocalPhotoItem[] = pickedList.map((p, idx) => ({
        id: `photo-${Date.now()}-${idx}-${Math.random()}`,
        path: p.path,
        mime: p.mime,
      }));
      setPhotos((prev) => [...prev, ...newItems]);
    }
  }

  function handleTakePhoto() {
    if (photos.length >= MAX_PHOTOS) return;
    setError(null);
    setShowCameraModal(true);
  }

  async function handleChooseGallery() {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) return;
    setError(null);
    try {
      const pickedList = await choosePhotos(remaining);
      if (pickedList && pickedList.length > 0) {
        const newItems: LocalPhotoItem[] = pickedList.map((p, idx) => ({
          id: `photo-${Date.now()}-${idx}`,
          path: p.path,
          mime: p.mime,
        }));
        setPhotos((prev) => [...prev, ...newItems]);
      }
    } catch (err: unknown) {
      const msg = handlePhotoPickerError(err, 'gallery');
      if (msg) setError(msg);
    }
  }

  function handleRemovePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function handleSelectPantryItem(record: LocalRecord, product?: Product | null) {
    const name = record.customName || product?.name || '';
    const brand = product?.brand ? `${product.brand} ` : '';
    const fullTitle = `${brand}${name}`.trim();
    if (fullTitle) setTitle(fullTitle);
    if (record.notes) {
      setDescription(record.notes);
    } else if (product?.description) {
      setDescription(product.description);
    } else {
      setDescription('');
    }
    if (record.expiryDate) {
      setExpiryDate(record.expiryDate);
    } else {
      setExpiryDate('');
    }

    const validRecordId =
      record.serverId || (record.id && record.id.length === 36 ? record.id : null);
    setSelectedRecordId(validRecordId);
    setSelectedProductId(record.productId ?? null);
    setMaxAvailableQty(record.quantity);
    setQuantity(Math.min(1, record.quantity));
    setUnit(record.unit || 'pcs');
    setLinkedPantryName(fullTitle || 'Pantry item');

    const existingImg =
      record.photoUrl ||
      product?.imageUrl ||
      (product?.photos && (product.photos[0]?.displayUrl || product.photos[0]?.thumbnailUrl));
    if (existingImg) {
      setPhotos([
        {
          id: `pantry-photo-${Date.now()}`,
          path: existingImg,
          uploadedUrl: existingImg,
        },
      ]);
    }
  }

  function handleUnlinkPantryItem() {
    setSelectedRecordId(null);
    setSelectedProductId(null);
    setMaxAvailableQty(null);
    setLinkedPantryName(null);
  }

  async function submit() {
    setError(null);
    if (!title.trim() || !locationText.trim()) {
      setError('Title and location are required.');
      return;
    }

    try {
      setUploadingPhotos(true);
      const uploadedUrls: string[] = [];

      // Upload all picked photos to server
      for (const p of photos) {
        if (p.uploadedUrl) {
          uploadedUrls.push(p.uploadedUrl);
        } else {
          try {
            const res = await uploadGiveawayPhoto({ path: p.path, mime: p.mime });
            uploadedUrls.push(res.photoUrl);
          } catch {
            // If upload fails, continue with local URL or fallback
            uploadedUrls.push(p.path);
          }
        }
      }

      await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        locationText: locationText.trim(),
        expiryDate: expiryDate || undefined,
        quantity,
        unit: unit.trim() || 'pcs',
        recordId: selectedRecordId || undefined,
        productId: selectedProductId || undefined,
        photoUrl: uploadedUrls.length > 0 ? uploadedUrls[0] : undefined,
        photoUrls: uploadedUrls.length > 0 ? uploadedUrls : undefined,
      });
      setUploadingPhotos(false);
      navigation.goBack();
    } catch (err: unknown) {
      setUploadingPhotos(false);
      setError((err as Error).message || 'Could not create giveaway.');
    }
  }

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: theme.colors.bg }]}
      contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      extraKeyboardOffset={Platform.OS === 'android' ? 195 : 100}
    >
      <View style={styles.header}>
        <Text style={[styles.eyebrow, { color: theme.colors.primaryDark }]}>
          COMMUNITY FOOD SHARING
        </Text>
        <Text style={[styles.heading, { color: theme.colors.text }]}>Offer to Neighbors</Text>
        <Text style={[styles.subheading, { color: theme.colors.textMuted }]}>
          Give food, pantry staples, or groceries to neighbors before they expire.
        </Text>
      </View>

      {/* Pantry Fast-Select Hero Card */}
      <Pressable
        testID="select-from-pantry-btn"
        accessibilityRole="button"
        accessibilityLabel="Select an item from your pantry"
        onPress={() => setShowPantryModal(true)}
        style={({ pressed }) => [
          styles.pantryHeroCard,
          {
            backgroundColor: pressed ? '#C7EADB' : '#D6F0E6',
            borderColor: '#4BAE8A',
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}
      >
        <View style={styles.pantryIconCircle}>
          <Ionicons name="basket" size={22} color="#FFFFFF" />
        </View>
        <View style={styles.pantryHeroTextCol}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.pantryHeroTitle, { color: '#2A6F54' }]}>
              Select from Your Pantry
            </Text>
            <View style={styles.fastAddPill}>
              <Text style={styles.fastAddPillText}>FAST FILL</Text>
            </View>
          </View>
          <Text style={[styles.pantryHeroSubtitle, { color: '#3A8F6F' }]}>
            Auto-fills photos, title, quantity, and expiry date
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#2A6F54" />
      </Pressable>
      {/* Linked Pantry Item Indicator */}
      {selectedRecordId && linkedPantryName ? (
        <View
          testID="linked-pantry-badge"
          style={[
            styles.linkedPantryCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.primary,
              borderRadius: theme.radii.md,
            },
          ]}
        >
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.linkIconCircle}>
              <Ionicons name="link-outline" size={14} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkedPantryLabel, { color: theme.colors.textMuted }]}>
                LINKED PANTRY RECORD
              </Text>
              <Text style={[styles.linkedPantryTitle, { color: theme.colors.text }]} numberOfLines={1}>
                {linkedPantryName}
                {maxAvailableQty !== null ? ` · ${maxAvailableQty} ${unit} in stock` : ''}
              </Text>
            </View>
          </View>
          <Pressable
            testID="unlink-pantry-btn"
            accessibilityRole="button"
            accessibilityLabel="Unlink pantry item"
            onPress={handleUnlinkPantryItem}
            hitSlop={8}
            style={styles.unlinkBtn}
          >
            <Ionicons name="close-circle" size={20} color={theme.colors.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <PantrySelectModal
        visible={showPantryModal}
        onClose={() => setShowPantryModal(false)}
        onSelectRecord={handleSelectPantryItem}
      />

      {/* Image Picker Section */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Photos ({photos.length}/{MAX_PHOTOS})
          </Text>
          {photos.length > 0 ? (
            <Text style={[styles.sectionHint, { color: theme.colors.textMuted }]}>
              First photo is the cover
            </Text>
          ) : null}
        </View>

        {photos.length === 0 ? (
          <View style={styles.emptyPhotoGrid}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take a photo with camera"
              onPress={handleTakePhoto}
              style={({ pressed }) => [
                styles.photoActionCard,
                {
                  backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View style={[styles.photoIconBadge, { backgroundColor: '#D6F0E6' }]}>
                <Ionicons name="camera" size={24} color="#2A6F54" />
              </View>
              <View style={styles.photoActionTextCol}>
                <Text style={[styles.photoActionTitle, { color: theme.colors.text }]}>Take Photo</Text>
                <Text style={[styles.photoActionSub, { color: theme.colors.textMuted }]}>
                  Camera capture
                </Text>
              </View>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select photo from gallery"
              onPress={handleChooseGallery}
              style={({ pressed }) => [
                styles.photoActionCard,
                {
                  backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
            >
              <View style={[styles.photoIconBadge, { backgroundColor: '#FEEFC3' }]}>
                <Ionicons name="images" size={24} color="#D48812" />
              </View>
              <View style={styles.photoActionTextCol}>
                <Text style={[styles.photoActionTitle, { color: theme.colors.text }]}>From Gallery</Text>
                <Text style={[styles.photoActionSub, { color: theme.colors.textMuted }]}>
                  Select multiple
                </Text>
              </View>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.photoList}
          >
            {photos.map((item, index) => (
              <View
                key={item.id}
                style={[
                  styles.photoCard,
                  {
                    borderColor: index === 0 ? theme.colors.primary : theme.colors.border,
                    backgroundColor: theme.colors.bgElevated,
                  },
                ]}
              >
                <Image
                  source={{ uri: item.path }}
                  style={styles.photoImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
                {index === 0 && (
                  <View style={[styles.coverBadge, { backgroundColor: theme.colors.primary }]}>
                    <Text style={styles.coverText}>Cover</Text>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  onPress={() => handleRemovePhoto(item.id)}
                  style={styles.removeBtn}
                >
                  <Ionicons name="close" size={13} color="#FFFFFF" />
                </Pressable>
              </View>
            ))}

            {photos.length < MAX_PHOTOS && (
              <View style={styles.addPhotoActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Take another photo with camera"
                  onPress={handleTakePhoto}
                  style={({ pressed }) => [
                    styles.compactAddPhotoBtn,
                    {
                      backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={[styles.compactIconBadge, { backgroundColor: '#D6F0E6' }]}>
                    <Ionicons name="camera" size={18} color="#2A6F54" />
                  </View>
                  <Text style={[styles.compactAddText, { color: theme.colors.text }]}>Camera</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add more photos from gallery"
                  onPress={handleChooseGallery}
                  style={({ pressed }) => [
                    styles.compactAddPhotoBtn,
                    {
                      backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <View style={[styles.compactIconBadge, { backgroundColor: '#FEEFC3' }]}>
                    <Ionicons name="images" size={18} color="#D48812" />
                  </View>
                  <Text style={[styles.compactAddText, { color: theme.colors.text }]}>Gallery</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        )}

        <View style={styles.photoTipRow}>
          <Ionicons name="information-circle-outline" size={15} color={theme.colors.primaryDark} />
          <Text style={[styles.photoTipText, { color: theme.colors.textMuted }]}>
            First photo is shown on the community feed. Long-press in gallery to select multiple.
          </Text>
        </View>
      </View>
      {/* Form Fields */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Item Title *</Text>
        <TextInput
          testID="giveaway-title-input"
          accessibilityLabel="Giveaway title"
          placeholder="e.g. 2 Unopened boxes of Organic Pasta"
          placeholderTextColor={theme.colors.textMuted}
          value={title}
          onChangeText={setTitle}
          onFocus={() => handleSetFocusedField('title')}
          onBlur={() => handleSetFocusedField(null)}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: getFieldBorderColor('title'),
              borderWidth: focusedField === 'title' ? 1.5 : 1,
              borderRadius: theme.radii.md,
              color: theme.colors.text,
            },
          ]}
        />
      </View>


      {/* Quantity and Unit Controls */}
      <View style={styles.fieldGroup}>
        <View style={styles.labelRow}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
            Quantity to Give Away *
          </Text>
          {maxAvailableQty !== null ? (
            <View style={styles.stockHintBadge}>
              <Text style={styles.stockHintText}>
                In pantry: {maxAvailableQty} {unit}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.quantityRow}>
          <View
            style={[
              styles.stepperWrap,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
              },
            ]}
          >
            <Pressable
              testID="qty-decrement-btn"
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              disabled={quantity <= 1}
              onPress={() => setQuantity((prev) => Math.max(1, prev - 1))}
              style={[styles.stepperBtn, { opacity: quantity <= 1 ? 0.35 : 1 }]}
            >
              <Ionicons name="remove" size={18} color={theme.colors.text} />
            </Pressable>
            <Text testID="giveaway-qty-value" style={[styles.stepperValue, { color: theme.colors.text }]}>
              {quantity}
            </Text>
            <Pressable
              testID="qty-increment-btn"
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              disabled={maxAvailableQty !== null && quantity >= maxAvailableQty}
              onPress={() =>
                setQuantity((prev) =>
                  maxAvailableQty !== null ? Math.min(maxAvailableQty, prev + 1) : prev + 1,
                )
              }
              style={[
                styles.stepperBtn,
                {
                  opacity:
                    maxAvailableQty !== null && quantity >= maxAvailableQty ? 0.35 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={18} color={theme.colors.text} />
            </Pressable>
          </View>

          <TextInput
            testID="giveaway-unit-input"
            accessibilityLabel="Quantity unit"
            placeholder="Unit (e.g. pcs, cans, kg)"
            placeholderTextColor={theme.colors.textMuted}
            value={unit}
            onChangeText={setUnit}
            onFocus={() => handleSetFocusedField('unit')}
            onBlur={() => handleSetFocusedField(null)}
            style={[
              styles.unitInput,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: getFieldBorderColor('unit'),
                borderWidth: focusedField === 'unit' ? 1.5 : 1,
                borderRadius: theme.radii.md,
                color: theme.colors.text,
              },
            ]}
          />
        </View>

        {/* Quick Unit Preset Pills */}
        <View style={styles.unitPillsRow}>
          {COMMON_UNITS.map((u) => {
            const isSelected = unit === u;
            return (
              <Pressable
                key={u}
                accessibilityRole="button"
                accessibilityLabel={`Select unit ${u}`}
                onPress={() => setUnit(u)}
                style={({ pressed }) => [
                  styles.unitPill,
                  {
                    backgroundColor: isSelected ? theme.colors.primaryLight : theme.colors.bgElevated,
                    borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.unitPillText,
                    {
                      color: isSelected ? theme.colors.primaryDark : theme.colors.textMuted,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {u}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.fieldGroup}>
        <View style={styles.labelRow}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
            Pickup Location / Neighborhood *
          </Text>
          {profileLocation && locationText !== profileLocation ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Auto-fill location from profile"
              onPress={() => setLocation(profileLocation)}
              hitSlop={8}
              style={styles.profileLocationBtn}
            >
              <Ionicons name="location-outline" size={13} color={theme.colors.primaryDark} />
              <Text style={styles.profileLocationBtnText}>Use profile address</Text>
            </Pressable>
          ) : profileLocation && locationText === profileLocation ? (
            <View style={styles.profileLocationFilledBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#3A8F6F" />
              <Text style={styles.profileLocationFilledText}>From profile</Text>
            </View>
          ) : null}
        </View>
        <TextInput
          testID="giveaway-location-input"
          accessibilityLabel="Pickup location"
          placeholder="e.g. Downtown near Central Park or Porch Pickup"
          placeholderTextColor={theme.colors.textMuted}
          value={locationText}
          onChangeText={setLocation}
          onFocus={() => handleSetFocusedField('location')}
          onBlur={() => handleSetFocusedField(null)}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: getFieldBorderColor('location'),
              borderWidth: focusedField === 'location' ? 1.5 : 1,
              borderRadius: theme.radii.md,
              color: theme.colors.text,
            },
          ]}
        />
      </View>
      {/* Item Expiry Date Field (Optional) */}
      <View style={styles.fieldGroup}>
        <View style={styles.labelRow}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>
            Item Expiration Date (Optional)
          </Text>
          {expiryDate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear expiration date"
              onPress={() => setExpiryDate('')}
              hitSlop={8}
            >
              <Text style={{ color: theme.colors.danger, fontSize: 12, fontWeight: '600' }}>
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Select expiration date"
          onPress={() => setShowDatePicker(true)}
          style={[
            styles.input,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="calendar-outline" size={18} color={theme.colors.primary} />
            <Text
              style={{
                color: expiryDate ? theme.colors.text : theme.colors.textMuted,
                fontSize: 15,
                fontWeight: expiryDate ? '600' : '400',
              }}
            >
              {expiryDate ? formatDate(expiryDate, userCountry) : 'Select expiration date'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
        </Pressable>

        {/* Date Preset Chips */}
        <View style={styles.datePresetsRow}>
          {DATE_PRESETS.map((p) => (
            <Pressable
              key={p.label}
              accessibilityRole="button"
              accessibilityLabel={`Set expiry date to ${p.label}`}
              onPress={() => {
                const d = new Date();
                d.setDate(d.getDate() + p.days);
                setExpiryDate(d.toISOString().slice(0, 10));
              }}
              style={({ pressed }) => [
                styles.datePresetPill,
                {
                  backgroundColor: pressed ? theme.colors.primaryLight : theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.datePresetText, { color: theme.colors.primaryDark }]}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <WheelDatePickerModal
        visible={showDatePicker}
        value={expiryDate}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(iso) => setExpiryDate(iso)}
      />
      <MultiPhotoCameraModal
        visible={showCameraModal}
        maxPhotos={Math.max(0, MAX_PHOTOS - photos.length)}
        title="Giveaway Photos"
        onCapture={handleCameraCapture}
        onClose={() => setShowCameraModal(false)}
      />

      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>Description & Notes</Text>
        <TextInput
          testID="giveaway-description-input"
          accessibilityLabel="Giveaway description"
          placeholder="Pickup notes, best time to collect, or allergy details…"
          placeholderTextColor={theme.colors.textMuted}
          value={description}
          onChangeText={setDescription}
          onFocus={() => handleSetFocusedField('description')}
          onBlur={() => handleSetFocusedField(null)}
          multiline
          numberOfLines={3}
          style={[
            styles.multilineInput,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: getFieldBorderColor('description'),
              borderWidth: focusedField === 'description' ? 1.5 : 1,
              borderRadius: theme.radii.md,
              color: theme.colors.text,
            },
          ]}
        />
      </View>
      {error ? <Text style={[styles.errorText, { color: theme.colors.danger }]}>{error}</Text> : null}

      {/* Submit CTA Button */}
      <View style={{ marginTop: 8, paddingBottom: 20 }}>
        <Button
          testID="post-giveaway-submit-btn"
          label={pending ? (uploadingPhotos ? 'Uploading Photos…' : 'Posting Giveaway…') : 'Post Giveaway'}
          icon="gift-outline"
          onPress={submit}
          loading={pending}
          disabled={pending}
        />
      </View>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    marginBottom: 4,
    gap: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heading: {
    fontSize: 24,
    fontWeight: '800',
  },
  subheading: {
    fontSize: 13,
    lineHeight: 18,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pantryHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    gap: 12,
  },
  pantryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#4BAE8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pantryHeroTextCol: {
    flex: 1,
    gap: 2,
  },
  pantryHeroTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  pantryHeroSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  fastAddPill: {
    backgroundColor: '#2A6F54',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  fastAddPillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  linkedPantryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  linkIconCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4BAE8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkedPantryLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  linkedPantryTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  unlinkBtn: {
    padding: 4,
  },
  cameraIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#D6F0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  galleryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#D6F0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockHintBadge: {
    backgroundColor: '#F0F0ED',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  stockHintText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3A8F6F',
  },
  unitPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  unitPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  unitPillText: {
    fontSize: 12,
  },
  profileLocationBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D6F0E6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profileLocationBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A6F54',
  },
  profileLocationFilledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#D6F0E6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  profileLocationFilledText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2A6F54',
  },
  datePresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  datePresetPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
  },
  datePresetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    gap: 8,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHint: {
    fontSize: 12,
  },
  photoTipText: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  photoList: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 4,
  },
  photoCard: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  coverBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: 'center',
  },
  coverText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    color: '#FFFFFF',
  },
  removeBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyPhotoGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  photoActionCard: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoActionTextCol: {
    alignItems: 'center',
    gap: 2,
  },
  photoActionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  photoActionSub: {
    fontSize: 11,
    fontWeight: '500',
  },
  addPhotoActions: {
    flexDirection: 'row',
    gap: 8,
  },
  compactAddPhotoBtn: {
    width: 82,
    height: 92,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  compactIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactAddText: {
    fontSize: 11,
    fontWeight: '600',
  },
  photoTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 2,
  },
  photoTipText: {
    flex: 1,
    fontSize: 11.5,
    lineHeight: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 48,
  },
  multilineInput: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 88,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    height: 48,
    width: 130,
  },
  stepperBtn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 32,
    textAlign: 'center',
  },
  unitInput: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    height: 48,
  },
});
