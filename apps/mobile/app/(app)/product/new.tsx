import { useState } from 'react';
import { Text, TextInput, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCreateProduct } from '../../../src/api/products';
import { AddRecordForm } from '../../../src/features/records/AddRecordForm';
import { ensurePushTokenRegistered } from '../../../src/features/push/registerPushToken';
import { useTheme } from '../../../src/theme/useTheme';
import { Button } from '../../../src/components/Button';

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
      <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.headlineSmall.fontSize, fontWeight: theme.typeRamp.headlineSmall.fontWeight as any }}>Add a product</Text>
      <Text style={{ color: theme.colors.textMuted }}>Give it a clear name so your pantry stays easy to scan.</Text>
      {params.barcode ? (
        <Text style={{ color: theme.colors.textMuted }}>Barcode: {params.barcode}</Text>
      ) : null}
      {params.qr ? <Text style={{ color: theme.colors.textMuted }}>QR: {params.qr}</Text> : null}
      <Text style={{ color: theme.colors.textMuted }}>Name</Text>
      <TextInput accessibilityLabel="Text input field" testID="new-product-name" style={input} value={name} onChangeText={setName} />
      <Text style={{ color: theme.colors.textMuted }}>Brand (optional)</Text>
      <TextInput accessibilityLabel="Text input field" testID="new-product-brand" style={input} value={brand} onChangeText={setBrand} />
      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
      <Button testID="new-product-create" label="Continue" icon="arrow-forward" onPress={submit} loading={createProduct.isPending} />
    </ScrollView>
  );
}
