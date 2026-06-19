// apps/mobile/src/features/deals/DealForm.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { Deal } from '@expyrico/shared';
import { useCreateDeal, useUpdateDeal } from '../../api/deals';

interface Props {
  product: { id: string; name: string };
  existing?: Deal;
  onDone: () => void;
}

export function DealForm({ product, existing, onDone }: Props) {
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
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    color: '#111827',
  } as const;

  return (
    <View style={{ gap: 12, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
        {existing ? 'Edit deal' : `Deal for ${product.name}`}
      </Text>
      <TextInput
        accessibilityLabel="price"
        placeholder="Price"
        placeholderTextColor="#9ca3af"
        keyboardType="decimal-pad"
        value={price}
        onChangeText={setPrice}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="store"
        placeholder="Store name"
        placeholderTextColor="#9ca3af"
        value={storeName}
        onChangeText={setStoreName}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="expiry"
        placeholder="Expiry (yyyy-mm-dd, optional)"
        placeholderTextColor="#9ca3af"
        value={expiryDate}
        onChangeText={setExpiryDate}
        editable={!pending}
        style={field}
      />
      <TextInput
        accessibilityLabel="note"
        placeholder="Note (optional)"
        placeholderTextColor="#9ca3af"
        value={note}
        onChangeText={setNote}
        multiline
        editable={!pending}
        style={[field, { minHeight: 80, textAlignVertical: 'top' }]}
      />
      {error ? <Text style={{ color: '#dc2626' }}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={submit}
        style={{
          padding: 14,
          borderRadius: 8,
          backgroundColor: '#2563eb',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#ffffff', fontWeight: '600' }}>
          {pending ? 'Saving…' : existing ? 'Save changes' : 'Post deal'}
        </Text>
      </Pressable>
    </View>
  );
}
