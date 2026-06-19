import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { createLocalRecord } from '../../api/records';
import { useMyHouseholds } from '../../api/households';
import { usePantryScope } from '../../store/pantryScope';
import { useTheme } from '../../theme/useTheme';

interface Props {
  productId?: string | null;
  productName?: string | null;
  customName?: string | null;
  onSaved: (localId: string) => void;
  onOpenOcr?: () => void;
}

const isoRe = /^\d{4}-\d{2}-\d{2}$/;

export function AddRecordForm({ productId, productName, customName, onSaved, onOpenOcr }: Props) {
  const theme = useTheme();
  const [expiry, setExpiry] = useState('');
  const [category, setCategory] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [notes, setNotes] = useState('');
  const [price, setPrice] = useState('');
  const [store, setStore] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string | null>(null);

  // Read the active scope so we pre-select the right household.
  const { scope: activeScope, householdId: scopeHhId } = usePantryScope();
  const { data: myHh } = useMyHouseholds();
  const households = myHh?.items ?? [];

  // If the active scope is a household, pre-select it.
  const effectiveHouseholdId =
    selectedHouseholdId ?? (activeScope === 'household' ? scopeHhId : null);

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
      const localId = await createLocalRecord({
        productId: productId ?? null,
        customName: productId ? null : (customName ?? productName ?? 'Item'),
        category: category || null,
        expiryDate: expiry,
        quantity: qty,
        unit,
        price: price ? Number(price) : null,
        store: store || null,
        notes: notes || null,
        householdId: effectiveHouseholdId,
      });
      onSaved(localId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const input = {
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  } as const;

  return (
    <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {productName ? (
        <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700' }}>
          {productName}
        </Text>
      ) : null}
      <Text style={{ color: theme.colors.textMuted }}>Expiry date</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <TextInput accessibilityLabel="Text input field"
          testID="add-record-expiry-input"
          style={[input, { flex: 1 }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.textMuted}
          value={expiry}
          onChangeText={setExpiry}
          autoCapitalize="none"
        />
        {onOpenOcr ? (
          <Pressable accessibilityRole="button"
            testID="add-record-ocr"
            onPress={onOpenOcr}
            style={{
              paddingHorizontal: theme.spacing.lg,
              justifyContent: 'center',
              borderRadius: theme.radii.md,
              backgroundColor: theme.colors.primary,
            }}
          >
            <Text style={{ color: theme.colors.primaryFg }}>Scan date</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={{ color: theme.colors.textMuted }}>Quantity</Text>
      <TextInput accessibilityLabel="Text input field"
        testID="add-record-quantity"
        style={input}
        value={quantity}
        keyboardType="numeric"
        onChangeText={setQuantity}
      />

      <Text style={{ color: theme.colors.textMuted }}>Unit</Text>
      <TextInput accessibilityLabel="Text input field" testID="add-record-unit" style={input} value={unit} onChangeText={setUnit} />

      <Text style={{ color: theme.colors.textMuted }}>Category (optional)</Text>
      <TextInput accessibilityLabel="Text input field"
        testID="add-record-category"
        style={input}
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Dairy"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={{ color: theme.colors.textMuted }}>Notes (optional)</Text>
      <TextInput accessibilityLabel="Text input field"
        testID="add-record-notes"
        style={input}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {/* Accordion: price + store are hidden by default (spec §2.2) */}
      <Pressable accessibilityRole="button" testID="add-record-more-toggle" onPress={() => setShowMore((v) => !v)}>
        <Text style={{ color: theme.colors.primary }}>
          {showMore ? '− Less details' : '+ More details (price, store)'}
        </Text>
      </Pressable>
      {showMore ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textMuted }}>Price (optional)</Text>
          <TextInput accessibilityLabel="Text input field"
            testID="add-record-price"
            style={input}
            value={price}
            keyboardType="numeric"
            onChangeText={setPrice}
          />
          <Text style={{ color: theme.colors.textMuted }}>Store (optional)</Text>
          <TextInput accessibilityLabel="Text input field"
            testID="add-record-store"
            style={input}
            value={store}
            onChangeText={setStore}
          />
        </View>
      ) : null}

      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}

      {/* Household picker — only shown when user has households */}
      {households.length > 0 ? (
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
    </View>
  );
}
