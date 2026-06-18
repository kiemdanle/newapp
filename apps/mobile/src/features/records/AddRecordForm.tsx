import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { createLocalRecord } from '../../api/records';
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
  const [showMore, setShowMore] = useState(false); // price/store accordion (spec §2.2)
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <TextInput
          testID="add-record-expiry-input"
          style={[input, { flex: 1 }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={theme.colors.textMuted}
          value={expiry}
          onChangeText={setExpiry}
          autoCapitalize="none"
        />
        {onOpenOcr ? (
          <Pressable
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
      <TextInput
        testID="add-record-quantity"
        style={input}
        value={quantity}
        keyboardType="numeric"
        onChangeText={setQuantity}
      />

      <Text style={{ color: theme.colors.textMuted }}>Unit</Text>
      <TextInput testID="add-record-unit" style={input} value={unit} onChangeText={setUnit} />

      <Text style={{ color: theme.colors.textMuted }}>Category (optional)</Text>
      <TextInput
        testID="add-record-category"
        style={input}
        value={category}
        onChangeText={setCategory}
        placeholder="e.g. Dairy"
        placeholderTextColor={theme.colors.textMuted}
      />

      <Text style={{ color: theme.colors.textMuted }}>Notes (optional)</Text>
      <TextInput
        testID="add-record-notes"
        style={input}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      {/* Accordion: price + store are hidden by default (spec §2.2) */}
      <Pressable testID="add-record-more-toggle" onPress={() => setShowMore((v) => !v)}>
        <Text style={{ color: theme.colors.primary }}>
          {showMore ? '− Less details' : '+ More details (price, store)'}
        </Text>
      </Pressable>
      {showMore ? (
        <View style={{ gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textMuted }}>Price (optional)</Text>
          <TextInput
            testID="add-record-price"
            style={input}
            value={price}
            keyboardType="numeric"
            onChangeText={setPrice}
          />
          <Text style={{ color: theme.colors.textMuted }}>Store (optional)</Text>
          <TextInput
            testID="add-record-store"
            style={input}
            value={store}
            onChangeText={setStore}
          />
        </View>
      ) : null}

      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}

      <Pressable
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
