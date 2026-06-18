import { useState } from 'react';
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProduct } from '../../../src/api/products';
import { AddRecordForm } from '../../../src/features/records/AddRecordForm';
import { OcrCamera } from '../../../src/features/expiry/OcrCamera';
import { useTheme } from '../../../src/theme/useTheme';
import { ensurePushTokenRegistered } from '../../../src/features/push/registerPushToken';

export default function ProductDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading } = useProduct(id);
  const [showOcr, setShowOcr] = useState(false);
  const [prefillDate, setPrefillDate] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>Loading product…</Text>
      </View>
    );
  }

  if (showOcr) {
    return (
      <OcrCamera
        onCancel={() => setShowOcr(false)}
        onParsed={(iso) => {
          setPrefillDate(iso);
          setShowOcr(false);
        }}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {data.imageUrl ? (
        <Image source={{ uri: data.imageUrl }} style={{ width: '100%', height: 200 }} />
      ) : null}
      <View style={{ padding: theme.spacing.lg }}>
        <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '700' }}>
          {data.name}
        </Text>
        {data.brand ? <Text style={{ color: theme.colors.textMuted }}>{data.brand}</Text> : null}
        {data.defaultShelfLifeDays ? (
          <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
            Default shelf life: {data.defaultShelfLifeDays} days
          </Text>
        ) : null}
        <View
          style={{
            marginTop: theme.spacing.lg,
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.bgElevated,
          }}
        >
          <Text style={{ color: theme.colors.textMuted }}>Reviews available in M2</Text>
        </View>
      </View>
      <AddRecordForm
        productId={data.id}
        productName={data.name}
        onOpenOcr={() => setShowOcr(true)}
        onSaved={async () => {
          await ensurePushTokenRegistered();
          router.replace('/home');
        }}
      />
      {prefillDate ? (
        <Text
          testID="ocr-prefill-hint"
          style={{ color: theme.colors.textMuted, paddingHorizontal: theme.spacing.lg }}
        >
          Scanned date: {prefillDate} (enter above)
        </Text>
      ) : null}
    </ScrollView>
  );
}
