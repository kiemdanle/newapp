import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { ScanCamera, type ScanResult } from '../../src/features/scan/ScanCamera';
import { useCameraPermission } from '../../src/features/scan/usePermission';
import { PrePromptModal } from '../../src/features/scan/PrePromptModal';
import { useProductLookupV2 } from '../../src/api/products';
import { AddRecordForm } from '../../src/features/records/AddRecordForm';
import { useTheme } from '../../src/theme/useTheme';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import type { AppNavigationProp } from '../../src/navigation/AppNavigator';

// Every branch below is a conclusive server outcome except `unavailable`,
// which covers both the schema-valid `temporarily_unavailable` response AND
// a thrown network/5xx error — the two are different failure modes but must
// present and behave identically (Retry + Scan again, never a path into
// product creation). Collapsing them into one UI state is what keeps that
// invariant enforceable in one place instead of two.
type ScanUiState =
  | { phase: 'scanning' }
  | { phase: 'looking-up' }
  | { phase: 'under-review' }
  | { phase: 'under-review-custom-item' }
  | { phase: 'not-found'; canCreate: boolean }
  | { phase: 'unavailable' };

export default function ScanScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const { state: permissionState, request, check } = useCameraPermission();
  const lookup = useProductLookupV2();
  const [prePrompt, setPrePrompt] = useState(true);
  const [ui, setUi] = useState<ScanUiState>({ phase: 'scanning' });
  const [customName, setCustomName] = useState('');
  const [customNameConfirmed, setCustomNameConfirmed] = useState(false);
  // Retained across looking-up/result phases so "Retry" can repeat the exact
  // same lookup without a rescan, and so a conclusive-miss Create action
  // carries the identifier that was actually scanned.
  const lastScanRef = useRef<ScanResult | null>(null);
  // A plain ref, not `ui.phase` state, gates re-entrancy: two scans arriving
  // in the same synchronous tick (before React has re-rendered `ui` to
  // 'looking-up') would otherwise both pass a `ui.phase !== 'scanning'`
  // check, since state updates don't apply mid-callback.
  const lookupInFlightRef = useRef(false);

  useEffect(() => {
    void check();
  }, [check]);

  const runLookup = useCallback(
    async (scan: ScanResult) => {
      lookupInFlightRef.current = true;
      setUi({ phase: 'looking-up' });
      try {
        const result = await lookup.mutateAsync(
          scan.kind === 'barcode' ? { barcode: scan.value } : { qr: scan.value },
        );
        switch (result.outcome) {
          case 'found':
            navigation.replace('Product', { id: result.product.id });
            return;
          case 'editable_private':
            navigation.replace('ProductNew', {
              barcode: scan.kind === 'barcode' ? scan.value : '',
              qr: scan.kind === 'qr' ? scan.value : '',
              productId: result.product.id,
              resume: 'edit',
            });
            return;
          case 'creator_pending':
            navigation.replace('ProductNew', {
              barcode: scan.kind === 'barcode' ? scan.value : '',
              qr: scan.kind === 'qr' ? scan.value : '',
              productId: result.product.id,
              resume: 'pending',
            });
            return;
          case 'under_review':
            setUi({ phase: 'under-review' });
            return;
          case 'not_found':
            // Gated by the server's actor-specific capability, not a local
            // boolean — `not_found` alone never implies creation is allowed.
            setUi({ phase: 'not-found', canCreate: result.canCreate });
            return;
          case 'temporarily_unavailable':
            setUi({ phase: 'unavailable' });
            return;
        }
      } catch {
        // Any thrown error — network down, 5xx, timeout — is unavailable,
        // never a not-found. Upstream/network trouble must never imply the
        // item doesn't exist.
        setUi({ phase: 'unavailable' });
      } finally {
        lookupInFlightRef.current = false;
      }
    },
    [lookup, navigation],
  );

  const handleScan = useCallback(
    (scan: ScanResult) => {
      // Pause: ignore further codes while a lookup is in flight or a
      // conclusive result is already being shown — ScanCamera's own 2s
      // same-code debounce only dedupes identical repeats, not a second,
      // different code arriving mid-lookup.
      if (ui.phase !== 'scanning' || lookupInFlightRef.current) return;
      lastScanRef.current = scan;
      void runLookup(scan);
    },
    [ui.phase, runLookup],
  );

  const scanAgain = useCallback(() => {
    lastScanRef.current = null;
    setCustomName('');
    setCustomNameConfirmed(false);
    // Full remount (ScanCamera unmounts below when phase !== 'scanning')
    // resets its internal debounce ref and re-focuses the camera hardware —
    // simpler and more robust than threading an explicit reset call through.
    setUi({ phase: 'scanning' });
  }, []);

  const retry = useCallback(() => {
    const scan = lastScanRef.current;
    if (!scan) {
      scanAgain();
      return;
    }
    void runLookup(scan);
  }, [runLookup, scanAgain]);

  const openCreate = useCallback(() => {
    const scan = lastScanRef.current;
    navigation.replace('ProductNew', {
      barcode: scan?.kind === 'barcode' ? scan.value : '',
      qr: scan?.kind === 'qr' ? scan.value : '',
    });
  }, [navigation]);

  if (permissionState === 'unknown') {
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
  if (permissionState === 'denied') {
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
      {ui.phase === 'scanning' ? <ScanCamera onScan={handleScan} /> : null}
      <View style={[styles.topBar, { backgroundColor: theme.colors.bgElevated, borderBottomColor: theme.colors.border }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: theme.colors.primaryLight }]}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.primaryDark} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: theme.colors.primaryDark }]}>PANTRY SCAN</Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>Find your item</Text>
        </View>
      </View>

      {ui.phase === 'scanning' ? (
        <View pointerEvents="none" style={styles.guide}>
          <View style={[styles.frame, { borderColor: theme.colors.primary }]} />
          <View style={[styles.instruction, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderRadius: theme.radii.pill }]}>
            <Ionicons name="barcode-outline" size={18} color={theme.colors.primaryDark} />
            <Text style={[styles.instructionText, { color: theme.colors.text }]}>Center the barcode or QR code in the frame</Text>
          </View>
        </View>
      ) : null}

      {ui.phase === 'looking-up' ? (
        <View accessibilityLiveRegion="polite" style={[styles.loading, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderRadius: theme.radii.pill }]}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text style={{ color: theme.colors.text }}>Looking up item…</Text>
        </View>
      ) : null}

      {ui.phase === 'under-review' ? (
        <View testID="scan-under-review" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>This item is awaiting review</Text>
          <Text style={{ color: theme.colors.textMuted }}>We can't show its details yet, but you can still track it in your pantry.</Text>
          <Button testID="scan-add-custom-item" label="Add as custom item" onPress={() => setUi({ phase: 'under-review-custom-item' })} />
          <Button testID="scan-again" label="Scan again" variant="outline" onPress={scanAgain} />
        </View>
      ) : null}

      {ui.phase === 'under-review-custom-item' ? (
        <View testID="scan-custom-item-form" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          {!customNameConfirmed ? (
            <>
              <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>Name this item</Text>
              <TextInput
                accessibilityLabel="Custom item name"
                testID="scan-custom-item-name"
                style={{ color: theme.colors.text, borderColor: theme.colors.border, borderWidth: 1, borderRadius: theme.radii.md, padding: theme.spacing.md }}
                placeholder="e.g. Frozen peas"
                placeholderTextColor={theme.colors.textMuted}
                value={customName}
                onChangeText={setCustomName}
              />
              <Button
                testID="scan-custom-item-continue"
                label="Continue"
                disabled={customName.trim().length === 0}
                onPress={() => {
                  setCustomName((v) => v.trim());
                  setCustomNameConfirmed(true);
                }}
              />
            </>
          ) : (
            // No private ID is ever attached here: under_review never authorizes
            // a draft, this is strictly the unlinked-custom-item fallback.
            <AddRecordForm
              productId={null}
              customName={customName}
              onSaved={() => navigation.replace('Tabs')}
            />
          )}
        </View>
      ) : null}

      {ui.phase === 'not-found' ? (
        <View testID="scan-not-found" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>We couldn't find this item</Text>
          {ui.canCreate ? (
            <Button testID="scan-create" label="Create" icon="add" onPress={openCreate} />
          ) : (
            <Text style={{ color: theme.colors.textMuted }}>Creating new products isn't available right now.</Text>
          )}
          <Button testID="scan-again" label="Scan again" variant="outline" onPress={scanAgain} />
        </View>
      ) : null}

      {ui.phase === 'unavailable' ? (
        <View testID="scan-unavailable" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 16 }}>Lookup is temporarily unavailable</Text>
          <Text style={{ color: theme.colors.textMuted }}>This isn't a "not found" — please try again.</Text>
          <Button testID="scan-retry" label="Retry" onPress={retry} />
          <Button testID="scan-again" label="Scan again" variant="outline" onPress={scanAgain} />
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
  resultPanel: { borderWidth: 1, borderRadius: 16, gap: 12, margin: 20, marginTop: 100, padding: 20 },
});
