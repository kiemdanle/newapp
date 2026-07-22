import { useState } from 'react';
import { View, Text, Image, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useProduct } from '../../../src/api/products';
import { AddRecordForm } from '../../../src/features/records/AddRecordForm';
import { OcrCamera } from '../../../src/features/expiry/OcrCamera';
import { useTheme } from '../../../src/theme/useTheme';
import { ensurePushTokenRegistered } from '../../../src/features/push/registerPushToken';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';

export default function ProductDetail() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute();
  const { id } = route.params as { id: string };
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
        <Image source={{ uri: data.imageUrl }} style={{ width: '100%', height: 220 }} accessibilityIgnoresInvertColors />
      ) : null}
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
        <Text style={{ color: theme.colors.primaryDark, fontSize: theme.typeRamp.labelMedium.fontSize, fontWeight: theme.typeRamp.labelMedium.fontWeight as any, letterSpacing: 1 }}>PRODUCT</Text>
        <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.headlineMedium.fontSize, fontWeight: theme.typeRamp.headlineMedium.fontWeight as any }}>
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
            backgroundColor: theme.colors.bgGlass,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Text style={{ color: theme.colors.textMuted }}>Save it now, then add an expiry date to keep it on your radar.</Text>
        </View>
      </View>
      <AddRecordForm
        productId={data.id}
        productName={data.name}
        onOpenOcr={() => setShowOcr(true)}
        onSaved={async () => {
          await ensurePushTokenRegistered();
          navigation.replace('Tabs');
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
