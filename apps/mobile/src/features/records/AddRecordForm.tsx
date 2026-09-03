import { useState } from 'react';
import { Image, Pressable, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { createLocalRecord } from '../../api/records';
import { useCreateOrResumeDraft, usePatchDraft } from '../../api/products';
import { uploadProductPhoto } from '../../api/product-photo-upload';
import { useMyHouseholds } from '../../api/households';
import { usePantryScope } from '../../store/pantryScope';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';
import { choosePhotos, handlePhotoPickerError, type PickedPhoto } from '../products/photo-picker-adapter';
import { WheelDatePickerModal } from '../../components/WheelDatePickerModal';
import { MultiPhotoCameraModal } from '../../components/MultiPhotoCameraModal';
interface Props {
  productId?: string | null;
  productName?: string | null;
  customName?: string | null;
  onSaved: (localId: string) => void;
  onOpenOcr?: () => void;
  /** True while the product this record attaches to is still private
   * (draft/pending, pre-approval) — the household picker is hidden and the
   * record is unconditionally created in the signed-in user's personal
   * scope, never a shared household, until the product goes public. */
  lockedPersonalScope?: boolean;
}

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export function AddRecordForm({ productId, productName, customName, onSaved, onOpenOcr, lockedPersonalScope }: Props) {
  const theme = useTheme();
  const [expiry, setExpiry] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [store, setStore] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const createOrResumeDraft = useCreateOrResumeDraft();
  const patchDraft = usePatchDraft();
  const { scope: activeScope, householdId: scopeHhId, defaultHouseholdId } = usePantryScope();
  const { data: myHh } = useMyHouseholds();
  const households = myHh?.items ?? [];

  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(() => {
    if (lockedPersonalScope) return null;
    if (activeScope === 'household') return scopeHhId;
    if (activeScope === 'all' && defaultHouseholdId) return defaultHouseholdId;
    return null;
  });
  const effectiveHouseholdId = lockedPersonalScope ? null : selectedHouseholdId;

  const save = async () => {
    if (!isoRe.test(expiry)) {
      setError('Expiry date is required (YYYY-MM-DD)');
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty < 0) {
      setError('Quantity must be a non-negative number');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let finalProductId = productId ?? null;

      // If this is a custom item (no catalog product yet) and the user attached a photo,
      // create a private product draft and upload the photo so it is permanently stored in cloud media storage
      if (!finalProductId && photo) {
        try {
          const draftRes = await createOrResumeDraft.mutateAsync({
            barcode: null,
            qrPayload: null,
          });
          finalProductId = draftRes.product.id;

          await patchDraft.mutateAsync({
            id: finalProductId,
            version: draftRes.product.version,
            name: customName ?? productName ?? 'Custom Item',
            category: category || null,
          });

          const uploadHandle = uploadProductPhoto(
            { kind: 'draft', productId: draftRes.product.id },
            { path: photo.path, mime: photo.mime },
          );
          await uploadHandle.promise;
        } catch (uploadErr) {
          // Non-fatal: if offline, continue with local creation
        }
      }

      const localId = await createLocalRecord({
        productId: finalProductId,
        customName: finalProductId ? null : (customName ?? productName ?? 'Item'),
        category: category || null,
        expiryDate: expiry,
        quantity: qty,
        unit,
        price: price ? Number(price) : null,
        store: store || null,
        notes: notes || null,
        photoUrl: photo ? photo.path : null,
        householdId: effectiveHouseholdId,
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
  const onCameraCapture = (pickedList: PickedPhoto[]) => {
    if (pickedList && pickedList.length > 0 && pickedList[0]) {
      setPhoto(pickedList[0]);
    }
  };

  const onTakePhoto = () => {
    setError(null);
    setShowCameraModal(true);
  };

  const onChoosePhotos = async () => {
    try {
      const picked = await choosePhotos(1);
      if (picked.length > 0 && picked[0]) setPhoto(picked[0]);
    } catch (err) {
      const msg = handlePhotoPickerError(err, 'gallery');
      if (msg) setError(msg);
    }
  };

  return (
    <View style={{ padding: theme.spacing.md, gap: theme.spacing.md }}>
      {productName ? (
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
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Item photo (optional)</Text>
        {photo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ position: 'relative', width: 68, height: 68 }}>
              <Image
                testID="add-record-photo-preview"
                source={{ uri: photo.path.startsWith('/') ? `file://${photo.path}` : photo.path }}
                style={{ width: 68, height: 68, borderRadius: theme.radii.md, backgroundColor: theme.colors.neutralLight }}
                accessibilityIgnoresInvertColors
              />
              <Pressable
                testID="add-record-photo-remove"
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                onPress={() => setPhoto(null)}
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
            <Text style={{ color: theme.colors.primary, fontSize: 13, fontWeight: '600' }}>Photo attached</Text>
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
                {expiry ? expiry : 'Select expiry date'}
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
      </View>

      <WheelDatePickerModal
        visible={showDatePicker}
        value={expiry}
        onClose={() => setShowDatePicker(false)}
        onConfirm={(iso) => setExpiry(iso)}
      />

      {/* Compact 2-Column Quantity & Unit */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Quantity</Text>
          <TextInput
            accessibilityLabel="Text input field"
            testID="add-record-quantity"
            style={[input, { minHeight: 48 }]}
            value={quantity}
            keyboardType="numeric"
            onChangeText={setQuantity}
          />
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Unit</Text>
          <TextInput
            accessibilityLabel="Text input field"
            testID="add-record-unit"
            style={[input, { minHeight: 48 }]}
            value={unit}
            onChangeText={setUnit}
          />
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Category (optional)</Text>
        <TextInput
          accessibilityLabel="Text input field"
          testID="add-record-category"
          style={[input, { minHeight: 48 }]}
          value={category}
          onChangeText={setCategory}
          placeholder="e.g. Dairy, Produce"
          placeholderTextColor={theme.colors.textMuted}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Notes (optional)</Text>
        <TextInput
          accessibilityLabel="Text input field"
          testID="add-record-notes"
          style={[input, { minHeight: 64 }]}
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
              style={[input, { minHeight: 48 }]}
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
              style={[input, { minHeight: 48 }]}
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
        <View style={{ gap: theme.spacing.xs }}>
          <Text style={{ color: theme.colors.textMuted }}>Pantry</Text>
          <View style={{ flexDirection: 'row', gap: theme.spacing.xs, flexWrap: 'wrap' }}>
            <Pressable
              testID="add-record-pantry-personal"
              accessibilityRole="button"
              onPress={() => setSelectedHouseholdId(null)}
              style={{
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.xs,
                borderRadius: theme.radii.sm,
                borderWidth: 1,
                borderColor: !effectiveHouseholdId ? theme.colors.primary : theme.colors.border,
                backgroundColor: !effectiveHouseholdId ? theme.colors.primary + '20' : 'transparent',
              }}
            >
              <Text style={{ color: !effectiveHouseholdId ? theme.colors.primary : theme.colors.textMuted, fontSize: 12 }}>
                Personal
              </Text>
            </Pressable>
            {households.map((h) => (
              <Pressable
                key={h.id}
                testID={`add-record-pantry-${h.id}`}
                accessibilityRole="button"
                onPress={() => setSelectedHouseholdId(h.id)}
                style={{
                  paddingHorizontal: theme.spacing.md,
                  paddingVertical: theme.spacing.xs,
                  borderRadius: theme.radii.sm,
                  borderWidth: 1,
                  borderColor: effectiveHouseholdId === h.id ? theme.colors.primary : theme.colors.border,
                  backgroundColor: effectiveHouseholdId === h.id ? theme.colors.primary + '20' : 'transparent',
                }}
              >
                <Text style={{ color: effectiveHouseholdId === h.id ? theme.colors.primary : theme.colors.textMuted, fontSize: 12 }}>
                  {h.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable accessibilityRole="button"
        testID="add-record-save"
        disabled={busy}
        onPress={save}
        style={{
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: theme.colors.primaryFg, fontWeight: '700' }}>
          {busy ? 'Saving…' : 'Save'}
        </Text>
      </Pressable>
      <MultiPhotoCameraModal
        visible={showCameraModal}
        maxPhotos={1}
        title="Item Photo"
        onCapture={onCameraCapture}
        onClose={() => setShowCameraModal(false)}
      />
    </View>
  );
}
