import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScanCamera, type ScanResult } from '../../src/features/scan/ScanCamera';
import { useCameraPermission } from '../../src/features/scan/usePermission';
import { PrePromptModal } from '../../src/features/scan/PrePromptModal';
import { useProductLookup } from '../../src/api/products';
import { useTheme } from '../../src/theme/useTheme';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';

export default function ScanScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { state, request, check } = useCameraPermission();
  const lookup = useProductLookup();
  const [prePrompt, setPrePrompt] = useState(true);

  useEffect(() => {
    void check();
  }, [check]);

  const handleScan = async (r: ScanResult) => {
    try {
      const product = await lookup.mutateAsync(
        r.kind === 'barcode' ? { barcode: r.value } : { qr: r.value },
      );
      if (product) router.replace(`/product/${product.id}`);
      else
        router.replace({
          pathname: '/product/new',
          params: {
            barcode: r.kind === 'barcode' ? r.value : '',
            qr: r.kind === 'qr' ? r.value : '',
          },
        });
    } catch {
      // 404 = no product
      router.replace({
        pathname: '/product/new',
        params: {
          barcode: r.kind === 'barcode' ? r.value : '',
          qr: r.kind === 'qr' ? r.value : '',
        },
      });
    }
  };

  if (state === 'unknown') {
    return (
      <PrePromptModal
        visible={prePrompt}
        onCancel={() => {
          setPrePrompt(false);
          router.back();
        }}
        onAllow={async () => {
          setPrePrompt(false);
          await request();
        }}
      />
    );
  }
  if (state === 'denied') {
    return (
      <Screen>
        <View style={{ alignItems: 'center', backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border, borderRadius: theme.radii.lg, borderWidth: 1, gap: theme.spacing.md, marginTop: theme.spacing.xxl, padding: theme.spacing.xl }}>
          <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.headlineSmall.fontSize, fontWeight: theme.typeRamp.headlineSmall.fontWeight as never }}>Camera access is off</Text>
          <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>Allow camera access in your phone settings to scan a barcode or expiry label.</Text>
          <Button label="Go back" variant="outline" icon="arrow-back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScanCamera onScan={handleScan} />
      {lookup.isPending ? (
        <View style={{ position: 'absolute', top: 40, alignSelf: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : null}
    </View>
  );
}
