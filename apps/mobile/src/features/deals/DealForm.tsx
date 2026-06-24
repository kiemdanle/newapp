// apps/mobile/src/features/deals/DealForm.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Deal } from '@expyrico/shared';
import { useCreateDeal, useUpdateDeal } from '../../api/deals';
import { useTheme } from '../../theme/useTheme';

interface Props {
  product: { id: string; name: string };
  existing?: Deal;
  onDone: () => void;
}

export function DealForm({ product, existing, onDone }: Props) {
  const theme = useTheme();
  const [price, setPrice] = useState(existing ? String(existing.price) : '');
  const [storeName, setStoreName] = useState(existing?.storeName ?? '');
  const [expiryDate, setExpiryDate] = useState(existing?.expiryDate ?? '');
  const [note, setNote] = useState(existing?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateDeal();
  const update = useUpdateDeal();
  const pending = create.isPending || update.isPending;

  async function submit() {
    setError(null);
    const parsedPrice = Number(price);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0 || !storeName.trim()) {
      setError('Enter a valid price and store.');
      return;
    }
    const expiry = /^\d{4}-\d{2}-\d{2}$/.test(expiryDate) ? expiryDate : undefined;
    try {
      if (existing) {
        await update.mutateAsync({
          id: existing.id,
          patch: {
            price: parsedPrice,
            storeName: storeName.trim(),
            expiryDate: expiry ?? null,
            note: note.trim() || null,
          },
        });
      } else {
        await create.mutateAsync({
          productId: product.id,
          price: parsedPrice,
          storeName: storeName.trim(),
          expiryDate: expiry,
          note: note.trim() || undefined,
        });
      }
      onDone();
    } catch {
      setError('Could not save your deal.');
    }
  }

  const field = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.bgElevated,
  } as const;

  return (
    <View style={{ gap: 12, padding: 16, backgroundColor: theme.colors.bg }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>
        {existing ? 'Edit deal' : `Deal for ${product.name}`}
      </Text>
      <TextInput
        accessibilityLabel="price"
        placeholder="Price"
        placeholderTextColor={theme.colors.textMuted}
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="store"
        placeholder="Store name"
        placeholderTextColor={theme.colors.textMuted}
        value={storeName}
        onChangeText={setStoreName}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="expiry"
        placeholder="Expiry (yyyy-mm-dd, optional)"
        placeholderTextColor={theme.colors.textMuted}
        value={expiryDate}
        onChangeText={setExpiryDate}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="note"
        placeholder="Note (optional)"
        placeholderTextColor={theme.colors.textMuted}
        value={note}
        onChangeText={setNote}
        multiline
        editable={!pending}
        style={[field, { minHeight: 80, textAlignVertical: 'top' }]}
      />
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={submit}
        style={{
          padding: 14,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.accent,
          alignItems: 'center',
          minHeight: 48,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Post deal'}
        </Text>
      </Pressable>
    </View>
  );
}
