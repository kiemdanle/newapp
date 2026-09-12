import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createLocalRecord } from '../../api/records';
import { useCreateOrResumeDraft, usePatchDraft, useProduct } from '../../api/products';
import { uploadProductPhoto } from '../../api/product-photo-upload';
import { useMyHouseholds } from '../../api/households';
import { usePantryScope } from '../../store/pantryScope';
import { useTheme } from '../../theme/useTheme';
import { formatDate } from '../../utils/country-format';
import { useSessionStore } from '../../auth/session-store';
import { Button } from '../../components/Button';
import { choosePhotos, handlePhotoPickerError, type PickedPhoto } from '../products/photo-picker-adapter';
import { WheelDatePickerModal } from '../../components/WheelDatePickerModal';
import { MultiPhotoCameraModal } from '../../components/MultiPhotoCameraModal';
import { ScopeSelectorPill } from './ScopeSelectorPill';
import { UnitSelector } from '../../components/UnitSelector';
import { LocationSelector } from '../../components/LocationSelector';
import { STANDARD_CATEGORIES } from './PantryFilterModal';
import { usePhotoLimits } from '../../utils/photo-limits';
import { usePantryLimits } from '../../utils/pantry-limits';
import { useMyActiveRecordCount } from './record-counters';
interface Props {
  productId?: string | null;
  productName?: string | null;
  customName?: string | null;
  initialCategory?: string | null;
  onSaved: (localId: string) => void;
  onOpenOcr?: () => void;
  /** True while the product this record attaches to is still private
   * (draft/pending, pre-approval) — the household picker is hidden and the
   * record is unconditionally created in the signed-in user's personal
   * scope, never a shared household, until the product goes public. */
  lockedPersonalScope?: boolean;
  scannedBarcode?: string;
  scannedExpiry?: string | null;
}

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export function AddRecordForm({
  productId,
  productName,
  customName,
  initialCategory,
  onSaved,
  onOpenOcr,
  lockedPersonalScope,
  scannedBarcode,
  scannedExpiry,
}: Props) {
  const theme = useTheme();
  const { data: product } = useProduct(productId ?? undefined);
  const lastProductIdRef = useRef(productId);
  const [location, setLocation] = useState<string | null>(null);
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const currentUserId = useSessionStore((s) => s.user?.id);
  const { defaultUserPantryLimit: pantryLimit } = usePantryLimits();
  const myActiveCount = useMyActiveRecordCount();
  const isAtCapacity = myActiveCount >= pantryLimit;
  const isNearCapacity = myActiveCount >= 0.9 * pantryLimit && !isAtCapacity;
  const hasUserEditedCategoryRef = useRef(false);
  const [itemName, setItemName] = useState(() => customName ?? productName ?? '');
  const [expiry, setExpiry] = useState('');
  const [category, setCategory] = useState(() => initialCategory || product?.category || '');
  if (lastProductIdRef.current !== productId) {
    lastProductIdRef.current = productId;
    hasUserEditedCategoryRef.current = false;
  }

  useEffect(() => {
    if (!hasUserEditedCategoryRef.current) {
      const cat = initialCategory || product?.category;
      if (cat) {
        setCategory(cat);
      }
    }
  }, [initialCategory, product?.category]);
  useEffect(() => {
    if (customName !== undefined && customName !== null) {
      setItemName(customName);
    }
  }, [customName]);
  useEffect(() => {
    if (!expiry && product?.defaultShelfLifeDays) {
      const d = new Date();
      d.setDate(d.getDate() + product.defaultShelfLifeDays);
      setExpiry(d.toISOString().slice(0, 10));
    }
  }, [expiry, product?.defaultShelfLifeDays]);
  useEffect(() => {
    if (scannedExpiry) {
      setExpiry(scannedExpiry);
    }
  }, [scannedExpiry]);
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [store, setStore] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const { maxPantryItemPhotos, maxProductPhotos } = usePhotoLimits();
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const createOrResumeDraft = useCreateOrResumeDraft();
  const patchDraft = usePatchDraft();
  const { scope: activeScope, householdId: scopeHhId, defaultPantryTarget, defaultHouseholdId } = usePantryScope();
  const { data: myHh } = useMyHouseholds();
  const households = myHh?.items ?? [];

  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(() => {
    if (lockedPersonalScope) return null;
    if (activeScope === 'household') return scopeHhId;
    if (activeScope === 'all') {
      const targetHhId =
        (defaultPantryTarget?.scope === 'household' ? defaultPantryTarget.householdId : null) ??
        defaultHouseholdId;
      if (targetHhId) return targetHhId;
    }
    return null;
  });
  const effectiveHouseholdId = lockedPersonalScope ? null : selectedHouseholdId;
  const save = async () => {
    if (isAtCapacity) {
      Alert.alert(
        'Pantry Limit Reached',
        `You have reached the maximum allowed items (${pantryLimit} items). You must consume, discard, or delete existing items to add new ones.`,
      );
      return;
    }
    setError(null);
    let finalProductId = productId ?? null;
    if (!finalProductId && !itemName.trim()) {
      setError('Item name is required');
      return;
    }
    if (!expiry) {
      setError('Expiry date is required');
      return;
    }
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError('Quantity must be greater than 0');
      return;
    }
    setBusy(true);
    try {
      // If this is a custom item (no catalog product yet) and the user attached photos or has a scanned barcode,
      // create a private product draft and attach barcode/photo so it is permanently stored in catalog/cloud media

      if (!finalProductId && (photos.length > 0 || scannedBarcode)) {
        try {
          const draftRes = await createOrResumeDraft.mutateAsync({
            barcode: scannedBarcode || null,
            qrPayload: null,
          });
          finalProductId = draftRes.product.id;

          await patchDraft.mutateAsync({
            id: finalProductId,
            version: draftRes.product.version,
            name: itemName.trim() || (customName ?? productName ?? 'Custom Item'),
            category: category.trim() || null,
          });

          const draftPhotosToUpload = photos.slice(0, maxProductPhotos);
          for (const p of draftPhotosToUpload) {
            const uploadHandle = uploadProductPhoto(
              { kind: 'draft', productId: draftRes.product.id },
              { path: p.path, mime: p.mime },
            );
            await uploadHandle.promise;
          }
        } catch {
          // Non-fatal: if offline, continue with local creation
        }
      }

      const localId = await createLocalRecord({
        productId: finalProductId,
        customName: finalProductId ? null : itemName.trim(),
        category: category.trim() || null,
        expiryDate: expiry,
        quantity: qty,
        unit,
        price: price ? Number(price) : null,
        store: store || null,
        notes: notes || null,
        photoUrl: null,
        localPhotos: photos.map((p) => p.path),
        location: location ? location.trim().slice(0, 50) : null,
        householdId: effectiveHouseholdId,
        userId: currentUserId ?? null,
      });
      onSaved(localId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const isDark = theme.scheme === 'dark';
  const input = {
    color: theme.colors.text,
    borderColor: isDark ? theme.colors.border : 'rgba(44, 44, 40, 0.08)',
    borderWidth: 1,
    borderRadius: theme.radii.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm + 4,
    fontSize: 15,
    backgroundColor: isDark ? theme.colors.bgElevated : '#FFFFFF',
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: isDark ? 0 : 0.03,
    shadowRadius: 3,
    elevation: 1,
  } as const;

  const getInputStyle = (fieldKey: string) => [
    input,
    {
      borderColor:
        focusedField === fieldKey
          ? theme.colors.primary
          : isDark
            ? theme.colors.border
            : 'rgba(44, 44, 40, 0.08)',
      borderWidth: focusedField === fieldKey ? 1.5 : 1,
    },
  ];
  const onCameraCapture = (pickedList: PickedPhoto[]) => {
    if (pickedList && pickedList.length > 0) {
      setPhotos((prev) => {
        const availableSlots = Math.max(0, maxPantryItemPhotos - prev.length);
        if (availableSlots <= 0) return prev;
        return [...prev, ...pickedList.slice(0, availableSlots)];
      });
    }
  };

  const onTakePhoto = () => {
    setError(null);
    setShowCameraModal(true);
  };

  const onChoosePhotos = async () => {
    try {
      const remaining = Math.max(0, maxPantryItemPhotos - photos.length);
      if (remaining <= 0) return;
      const picked = await choosePhotos(remaining);
      if (picked.length > 0) {
        setPhotos((prev) => {
          const availableSlots = Math.max(0, maxPantryItemPhotos - prev.length);
          if (availableSlots <= 0) return prev;
          return [...prev, ...picked.slice(0, availableSlots)];
        });
      }
    } catch (err) {
      const msg = handlePhotoPickerError(err, 'gallery');
      if (msg) setError(msg);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };
  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      {isAtCapacity ? (
        <View
          testID="add-record-capacity-blocked-banner"
          style={{
            backgroundColor: '#FDE8E8',
            borderColor: '#E0442A',
            borderWidth: 1,
            borderRadius: theme.radii.md,
            padding: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="alert-circle" size={20} color="#E0442A" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#E0442A', fontSize: 13, fontWeight: '700' }}>
              Pantry Limit Reached ({myActiveCount}/{pantryLimit} items)
            </Text>
            <Text style={{ color: '#9B1C1C', fontSize: 12, marginTop: 2 }}>
              You must consume, discard, or delete existing items to add new ones.
            </Text>
          </View>
        </View>
      ) : isNearCapacity ? (
        <View
          testID="add-record-capacity-warning-banner"
          style={{
            backgroundColor: '#FEEFC3',
            borderColor: '#F5A623',
            borderWidth: 1,
            borderRadius: theme.radii.md,
            padding: theme.spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Ionicons name="warning-outline" size={20} color="#F5A623" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#B45309', fontSize: 13, fontWeight: '700' }}>
              Pantry Nearly Full ({myActiveCount}/{pantryLimit} items)
            </Text>
            <Text style={{ color: '#92400E', fontSize: 12, marginTop: 2 }}>
              Consider consuming or sharing items before adding more.
            </Text>
          </View>
        </View>
      ) : null}
      {!productId ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Item name *</Text>
          <TextInput
            accessibilityLabel="Item Name"
            testID="add-record-custom-name"
            style={[getInputStyle('name'), { minHeight: 48 }]}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            value={itemName}
            onChangeText={setItemName}
            placeholder="e.g. Fresh salmon, Apples, Sourdough"
            placeholderTextColor={theme.colors.textMuted}
            autoFocus={!customName}
          />
        </View>
      ) : productName ? (
        <View style={{ gap: 2, marginBottom: 2 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            PANTRY ITEM
          </Text>
          <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700' }}>
            {productName}
          </Text>
        </View>
      ) : null}

      {/* Item Photo Section */}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Item photos (optional)</Text>
          {photos.length > 0 ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{photos.length}/{maxPantryItemPhotos} photos</Text>
          ) : null}
        </View>
        {photos.length > 0 ? (
          <View style={{ gap: 10 }}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
              keyboardShouldPersistTaps="handled"
            >
              {photos.map((p, index) => (
                <View key={`${p.path}-${index}`} style={{ position: 'relative', width: 68, height: 68 }}>
                  <Image
                    testID={index === 0 ? 'add-record-photo-preview' : `add-record-photo-preview-${index}`}
                    source={{ uri: p.path.startsWith('/') ? `file://${p.path}` : p.path }}
                    style={{ width: 68, height: 68, borderRadius: theme.radii.md, backgroundColor: theme.colors.neutralLight }}
                    accessibilityIgnoresInvertColors
                  />
                  <Pressable
                    testID={index === 0 ? 'add-record-photo-remove' : `add-record-photo-remove-${index}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${index + 1}`}
                    onPress={() => handleRemovePhoto(index)}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      backgroundColor: theme.colors.danger,
                      borderRadius: 11,
                      width: 22,
                      height: 22,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
              {photos.length < maxPantryItemPhotos ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add more photos"
                  testID="add-record-add-more-photos"
                  onPress={onChoosePhotos}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: theme.radii.md,
                    borderWidth: 1.5,
                    borderStyle: 'dashed',
                    borderColor: isDark ? theme.colors.border : theme.colors.primary,
                    backgroundColor: isDark ? theme.colors.bgGlass : theme.colors.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                  }}
                >
                  <Ionicons name="add" size={20} color={isDark ? theme.colors.primary : theme.colors.primaryDark} />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: isDark ? theme.colors.primary : theme.colors.primaryDark }}>Add</Text>
                </Pressable>
              ) : null}
            </ScrollView>
            {photos.length < maxPantryItemPhotos ? (
              <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
                <Button
                  testID="add-record-take-photo"
                  label="Take photo"
                  icon="camera"
                  variant="outline"
                  onPress={onTakePhoto}
                />
                <Button
                  testID="add-record-choose-photo"
                  label="Choose photo"
                  icon="images"
                  variant="outline"
                  onPress={onChoosePhotos}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <Button
              testID="add-record-take-photo"
              label="Take photo"
              icon="camera"
              variant="outline"
              onPress={onTakePhoto}
            />
            <Button
              testID="add-record-choose-photo"
              label="Choose photo"
              icon="images"
              variant="outline"
              onPress={onChoosePhotos}
            />
          </View>
        )}
      </View>

      {/* Expiry Date */}
      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Expiry date</Text>
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Select expiry date"
            testID="add-record-expiry-picker-trigger"
            onPress={() => setShowDatePicker(true)}
            style={[
              input,
              {
                flex: 1,
                minHeight: 48,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
              <Text
                style={{
                  color: expiry ? theme.colors.text : theme.colors.textMuted,
                  fontSize: 15,
                  fontWeight: expiry ? '600' : '400',
                }}
              >
                {expiry ? formatDate(expiry, userCountry) : 'Select expiry date'}
              </Text>
            </View>
            <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
            <TextInput
              accessibilityLabel="Text input field"
              testID="add-record-expiry-input"
              style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
              value={expiry}
              onChangeText={setExpiry}
              autoCapitalize="none"
            />
          </Pressable>
          {onOpenOcr ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan expiry date with camera"
              testID="add-record-ocr"
              onPress={onOpenOcr}
              style={({ pressed }) => [
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  paddingHorizontal: theme.spacing.md,
                  justifyContent: 'center',
                  borderRadius: theme.radii.md,
                  backgroundColor: isDark ? 'rgba(75, 174, 138, 0.18)' : '#D6F0E6',
                  borderWidth: 1,
                  borderColor: isDark ? 'rgba(75, 174, 138, 0.35)' : 'rgba(75, 174, 138, 0.25)',
                  minHeight: 48,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                },
              ]}
            >
              <Ionicons
                name="camera-outline"
                size={18}
                color={isDark ? theme.colors.primary : theme.colors.primaryDark}
              />
              <Text
                style={{
                  color: isDark ? theme.colors.primary : theme.colors.primaryDark,
                  fontWeight: '700',
                  fontSize: 13,
                }}
              >
                Scan date
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', gap: theme.spacing.xs, marginTop: 4 }}>
          {[
            { label: '+3d', days: 3 },
            { label: '+1w', days: 7 },
            { label: '+1m', days: 30 },
            { label: '+3m', days: 90 },
          ].map((preset) => (
            <Pressable
              key={preset.label}
              accessibilityRole="button"
              accessibilityLabel={`Set expiry to ${preset.label}`}
              testID={`add-record-date-preset-${preset.label.replace('+', '')}`}
              onPress={() => {
                const d = new Date();
                d.setDate(d.getDate() + preset.days);
                setExpiry(d.toISOString().slice(0, 10));
              }}
              style={({ pressed }) => ({
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: theme.radii.pill,
                backgroundColor: pressed ? theme.colors.primaryLight : theme.colors.bgGlass,
                borderWidth: 1,
                borderColor: theme.colors.border,
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.primaryDark }}>
                {preset.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <WheelDatePickerModal
        visible={showDatePicker}
        value={expiry}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(iso) => setExpiry(iso)}
      />

      {/* Quantity & Unit Selection */}
      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Quantity</Text>
        <TextInput
          accessibilityLabel="Text input field"
          testID="add-record-quantity"
          style={[getInputStyle('quantity'), { minHeight: 48 }]}
          onFocus={() => setFocusedField('quantity')}
          onBlur={() => setFocusedField(null)}
          value={quantity}
          keyboardType="numeric"
          onChangeText={setQuantity}
        />
      </View>

      <UnitSelector
        value={unit}
        onChange={setUnit}
        label="Unit"
        testID="add-record-unit-selector"
      />

      <LocationSelector
        value={location}
        onChange={setLocation}
        label="Location (optional)"
        testID="add-record-location-selector"
      />

      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Category (optional)</Text>
        <TextInput
          accessibilityLabel="Category"
          testID="add-record-category"
          style={[getInputStyle('category'), { minHeight: 48 }]}
          onFocus={() => setFocusedField('category')}
          onBlur={() => setFocusedField(null)}
          value={category}
          onChangeText={(val) => {
            hasUserEditedCategoryRef.current = true;
            setCategory(val);
          }}
          placeholder="e.g. Produce, Dairy, Bakery, Meat & Seafood, etc."
          placeholderTextColor={theme.colors.textMuted}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
          keyboardShouldPersistTaps="handled"
        >
          {STANDARD_CATEGORIES.map((cat) => {
            const isSelected = category.trim().toLowerCase() === cat.toLowerCase();
            return (
              <Pressable
                key={cat}
                testID={`add-record-category-chip-${cat.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                accessibilityRole="button"
                accessibilityLabel={`Select category ${cat}`}
                onPress={() => {
                  hasUserEditedCategoryRef.current = true;
                  setCategory(isSelected ? '' : cat);
                }}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: theme.radii.pill,
                    borderWidth: 1,
                    borderColor: isSelected ? theme.colors.primaryDark : theme.colors.border,
                    backgroundColor: isSelected
                      ? theme.colors.primaryLight
                      : pressed
                        ? theme.colors.bgGlass
                        : theme.colors.bgElevated,
                    minHeight: 32,
                    justifyContent: 'center',
                    alignItems: 'center',
                  },
                ]}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: isSelected ? '700' : '500',
                    color: isSelected ? theme.colors.primaryDark : theme.colors.text,
                  }}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Notes (optional)</Text>
        <TextInput
          accessibilityLabel="Text input field"
          testID="add-record-notes"
          style={[getInputStyle('notes'), { minHeight: 64 }]}
          onFocus={() => setFocusedField('notes')}
          onBlur={() => setFocusedField(null)}
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="e.g. Opened on Tuesday"
          placeholderTextColor={theme.colors.textMuted}
        />
      </View>

      {/* Accordion: price + store are hidden by default */}
      <Pressable accessibilityRole="button" testID="add-record-more-toggle" onPress={() => setShowMore((v) => !v)} style={{ paddingVertical: 2 }}>
        <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>
          {showMore ? '− Less details' : '+ More details (price, store)'}
        </Text>
      </Pressable>
      {showMore ? (
        <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Price (optional)</Text>
            <TextInput
              accessibilityLabel="Text input field"
              testID="add-record-price"
              style={[getInputStyle('price'), { minHeight: 48 }]}
              onFocus={() => setFocusedField('price')}
              onBlur={() => setFocusedField(null)}
              value={price}
              keyboardType="numeric"
              onChangeText={setPrice}
              placeholder="0.00"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Store (optional)</Text>
            <TextInput
              accessibilityLabel="Text input field"
              testID="add-record-store"
              style={[getInputStyle('store'), { minHeight: 48 }]}
              onFocus={() => setFocusedField('store')}
              onBlur={() => setFocusedField(null)}
              value={store}
              onChangeText={setStore}
              placeholder="e.g. Trader Joe's"
              placeholderTextColor={theme.colors.textMuted}
            />
          </View>
        </View>
      ) : null}


      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}

      {/* Household picker — only shown when user has households and the
          product isn't still private (lockedPersonalScope). */}
      {households.length > 0 && !lockedPersonalScope ? (
        <ScopeSelectorPill
          testID="add-record-scope-selector"
          selectedScope={effectiveHouseholdId ? 'household' : 'personal'}
          selectedHouseholdId={effectiveHouseholdId}
          onChange={(newScope, newHhId) => {
            setSelectedHouseholdId(newScope === 'household' ? newHhId : null);
          }}
        />
      ) : null}

      <Pressable accessibilityRole="button"
        testID="add-record-save"
        disabled={busy || isAtCapacity}
        onPress={save}
        style={{
          backgroundColor: isAtCapacity ? theme.colors.border : theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.md,
          alignItems: 'center',
          opacity: isAtCapacity ? 0.6 : 1,
        }}
      >
        <Text style={{ color: isAtCapacity ? theme.colors.textMuted : theme.colors.primaryFg, fontWeight: '700' }}>
          {isAtCapacity ? 'Pantry Limit Reached' : busy ? 'Saving…' : 'Save'}
        </Text>
      </Pressable>
      <MultiPhotoCameraModal
        visible={showCameraModal}
        maxPhotos={Math.max(1, maxPantryItemPhotos - photos.length)}
        title="Item Photos"
        onCapture={onCameraCapture}
        onClose={() => setShowCameraModal(false)}
      />
    </View>
  );
}
