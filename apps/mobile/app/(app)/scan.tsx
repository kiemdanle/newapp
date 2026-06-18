import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { ScanCamera, type ScanResult } from '../../src/features/scan/ScanCamera';
import { useCameraPermission } from '../../src/features/scan/usePermission';
import { PrePromptModal } from '../../src/features/scan/PrePromptModal';
import { useProductLookup } from '../../src/api/products';
import { useTheme } from '../../src/theme/useTheme';

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
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <Text style={{ color: theme.colors.text }}>Camera permission denied.</Text>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <ScanCamera onScan={handleScan} />
      {lookup.isPending ? (
        <View style={{ position: 'absolute', top: 40, alignSelf: 'center' }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
    </View>
  );
}
