import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateProduct } from '../../../src/api/products';
import { AddRecordForm } from '../../../src/features/records/AddRecordForm';
import { ensurePushTokenRegistered } from '../../../src/features/push/registerPushToken';
import { useTheme } from '../../../src/theme/useTheme';

export default function NewProductScreen() {
  const theme = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ barcode?: string; qr?: string }>();
  const createProduct = useCreateProduct();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    try {
      const product = await createProduct.mutateAsync({
        barcode: params.barcode || null,
        qrPayload: params.qr || null,
        name: name.trim(),
        brand: brand.trim() || null,
      });
      setProductId(product.id);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const input = {
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  } as const;

  if (productId) {
    return (
      <AddRecordForm
        productId={productId}
        productName={name}
        onSaved={async () => {
          await ensurePushTokenRegistered();
          router.replace('/home');
        }}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        backgroundColor: theme.colors.bg,
      }}
    >
      <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '700' }}>New product</Text>
      {params.barcode ? (
        <Text style={{ color: theme.colors.textMuted }}>Barcode: {params.barcode}</Text>
      ) : null}
      {params.qr ? <Text style={{ color: theme.colors.textMuted }}>QR: {params.qr}</Text> : null}
      <Text style={{ color: theme.colors.textMuted }}>Name</Text>
      <TextInput testID="new-product-name" style={input} value={name} onChangeText={setName} />
      <Text style={{ color: theme.colors.textMuted }}>Brand (optional)</Text>
      <TextInput testID="new-product-brand" style={input} value={brand} onChangeText={setBrand} />
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Pressable
        testID="new-product-create"
        onPress={submit}
        disabled={createProduct.isPending}
        style={{
          backgroundColor: theme.colors.primary,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: theme.colors.primaryFg, fontWeight: '700' }}>
          {createProduct.isPending ? 'Creating…' : 'Continue'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
