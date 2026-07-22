import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ScanCamera, type ScanResult } from '../../src/features/scan/ScanCamera';
import { useCameraPermission } from '../../src/features/scan/usePermission';
import { PrePromptModal } from '../../src/features/scan/PrePromptModal';
import { useProductLookup } from '../../src/api/products';
import { useTheme } from '../../src/theme/useTheme';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import type { AppNavigationProp } from '../../src/navigation/AppNavigator';

export default function ScanScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
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
      if (product) navigation.replace('Product', { id: product.id });
      else
        navigation.replace('ProductNew', {
          barcode: r.kind === 'barcode' ? r.value : '',
          qr: r.kind === 'qr' ? r.value : '',
        });
    } catch {
      // 404 = no product
      navigation.replace('ProductNew', {
        barcode: r.kind === 'barcode' ? r.value : '',
        qr: r.kind === 'qr' ? r.value : '',
      });
    }
  };

  if (state === 'unknown') {
    return (
      <PrePromptModal
        visible={prePrompt}
        onCancel={() => {
          setPrePrompt(false);
          navigation.goBack();
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
          <Button label="Go back" variant="outline" icon="arrow-back" onPress={() => navigation.goBack()} />
        </View>
      </Screen>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ScanCamera onScan={handleScan} />
      <View style={[styles.topBar, { backgroundColor: theme.colors.bgElevated, borderBottomColor: theme.colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: theme.colors.primaryLight }]}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.primaryDark} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: theme.colors.primaryDark }]}>PANTRY SCAN</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Find your item</Text>
        </View>
      </View>
      <View pointerEvents="none" style={styles.guide}>
        <View style={[styles.frame, { borderColor: theme.colors.primary }]} />
        <View style={[styles.instruction, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderRadius: theme.radii.pill }]}>
          <Ionicons name="barcode-outline" size={18} color={theme.colors.primaryDark} />
          <Text style={[styles.instructionText, { color: theme.colors.text }]}>Center the barcode or QR code in the frame</Text>
        </View>
      </View>
      {lookup.isPending ? (
        <View style={[styles.loading, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderRadius: theme.radii.pill }]}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ color: theme.colors.text }}>Looking up item…</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 52, paddingBottom: 14 },
  backButton: { alignItems: 'center', height: 48, justifyContent: 'center', width: 48, borderRadius: 24 },
  heading: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 18, fontWeight: '700', marginTop: 2 },
  guide: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', paddingTop: 44 },
  frame: { borderRadius: 22, borderWidth: 3, height: 232, width: 232 },
  instruction: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 24, paddingHorizontal: 16, paddingVertical: 12 },
  instructionText: { fontSize: 13, fontWeight: '600' },
  loading: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 10, position: 'absolute', top: 126, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 12 },
});
