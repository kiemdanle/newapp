import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, View, Text, TextInput, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScanCamera, type ScanResult } from '../../src/features/scan/ScanCamera';
import { useCameraPermission } from '../../src/features/scan/usePermission';
import { PrePromptModal } from '../../src/features/scan/PrePromptModal';
import { CameraPermissionDeniedModal } from '../../src/features/scan/CameraPermissionDeniedModal';
import { useProductLookupV2 } from '../../src/api/products';
import { AddRecordForm } from '../../src/features/records/AddRecordForm';
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView';
import { useTheme } from '../../src/theme/useTheme';
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
  | { phase: 'manual-entry' }
  | { phase: 'not-found'; canCreate: boolean }
  | { phase: 'unavailable' };

export default function ScanScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const route = useRoute();
  const { target, initialPhase } = (route.params ?? {}) as {
    target?: 'pantry' | 'deal';
    initialPhase?: 'scanning' | 'manual';
  };
  const insets = useSafeAreaInsets();
  const { state: permissionState, request, check } = useCameraPermission();
  const lookup = useProductLookupV2();
  const [prePrompt, setPrePrompt] = useState(true);
  const [ui, setUi] = useState<ScanUiState>(() =>
    initialPhase === 'manual' ? { phase: 'manual-entry' } : { phase: 'scanning' },
  );
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
  const appStateRef = useRef(AppState.currentState);
  const permissionRequestInFlightRef = useRef(false);
  const lookupGenerationRef = useRef(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const lookupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      lookupGenerationRef.current += 1;
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
        lookupTimeoutRef.current = null;
      }
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
    };
  }, []);

  const cancelLookup = useCallback(() => {
    lookupGenerationRef.current += 1;
    if (lookupTimeoutRef.current) {
      clearTimeout(lookupTimeoutRef.current);
      lookupTimeoutRef.current = null;
    }
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    lookupInFlightRef.current = false;
    setUi({ phase: 'manual-entry' });
  }, []);


  useEffect(() => {
    void check().catch(() => undefined);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        (appStateRef.current === 'inactive' || appStateRef.current === 'background') &&
        nextAppState === 'active'
      ) {
        void check().catch(() => undefined);
      }
      appStateRef.current = nextAppState;
    });

    return () => subscription.remove();
  }, [check]);

  const runLookup = useCallback(
    async (scan: ScanResult) => {
      lookupGenerationRef.current += 1;
      const currentGen = lookupGenerationRef.current;
      activeAbortControllerRef.current?.abort();
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;
      if (lookupTimeoutRef.current) {
        clearTimeout(lookupTimeoutRef.current);
        lookupTimeoutRef.current = null;
      }
      lookupTimeoutRef.current = setTimeout(() => controller.abort(), 8000);
      lookupInFlightRef.current = true;
      setUi({ phase: 'looking-up' });
      try {
        const result = await lookup.mutateAsync({
          ...(scan.kind === 'barcode' ? { barcode: scan.value } : { qr: scan.value }),
          signal: controller.signal,
        });
        if (lookupTimeoutRef.current) {
          clearTimeout(lookupTimeoutRef.current);
          lookupTimeoutRef.current = null;
        }
        if (lookupGenerationRef.current !== currentGen) return;

        switch (result.outcome) {
          case 'found':
            if (target === 'deal') {
              navigation.replace('DealNew', { productId: result.product.id });
            } else {
              navigation.replace('Product', { id: result.product.id });
            }
            return;
          case 'editable_private':
            if (target === 'deal') {
              navigation.replace('DealNew', { productId: result.product.id });
            } else {
              navigation.replace('ProductNew', {
                barcode: scan.kind === 'barcode' ? scan.value : '',
                qr: scan.kind === 'qr' ? scan.value : '',
                productId: result.product.id,
                resume: 'edit',
                target,
              });
            }
            return;
          case 'creator_pending':
            if (target === 'deal') {
              navigation.replace('DealNew', { productId: result.product.id });
            } else {
              navigation.replace('ProductNew', {
                barcode: scan.kind === 'barcode' ? scan.value : '',
                qr: scan.kind === 'qr' ? scan.value : '',
                productId: result.product.id,
                resume: 'pending',
                target,
              });
            }
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
          default:
            // M7: an outcome this build doesn't know about yet must still
            // resolve to the same never-create-from-this-state fallback
            // every non-conclusive result already uses, not leave `ui`
            // stuck on 'looking-up' forever with no escape but the back
            // button.
            setUi({ phase: 'unavailable' });
            return;
        }
      } catch {
        if (lookupTimeoutRef.current) {
          clearTimeout(lookupTimeoutRef.current);
          lookupTimeoutRef.current = null;
        }
        if (lookupGenerationRef.current !== currentGen) return;
        setUi({ phase: 'unavailable' });
      } finally {
        if (lookupTimeoutRef.current) {
          clearTimeout(lookupTimeoutRef.current);
          lookupTimeoutRef.current = null;
        }
        if (lookupGenerationRef.current === currentGen) {
          lookupInFlightRef.current = false;
        }
      }
    },
    [lookup, navigation, target],
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
    // L1: mirror handleScan's own in-flight guard — without it, two taps
    // inside one React batch could issue two lookups back to back.
    if (lookupInFlightRef.current) return;
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
      target,
    });
  }, [navigation, target]);
  if (ui.phase !== 'manual-entry') {
    if (permissionState === 'unknown') {
      return (
        <PrePromptModal
          visible={prePrompt}
          onCancel={() => {
            setPrePrompt(false);
            navigation.goBack();
          }}
          onAddManually={() => {
            setPrePrompt(false);
            setUi({ phase: 'manual-entry' });
          }}
          onAllow={() => {
            if (permissionRequestInFlightRef.current) return;
            permissionRequestInFlightRef.current = true;
            void request()
              .then(() => setPrePrompt(false))
              .catch(() => undefined)
              .finally(() => {
                permissionRequestInFlightRef.current = false;
              });
          }}
        />
      );
    }
    if (permissionState === 'denied') {
      return (
        <CameraPermissionDeniedModal
          onCancel={() => navigation.goBack()}
          onAddManually={() => setUi({ phase: 'manual-entry' })}
          onOpenSettings={() => {
            void Linking.openSettings().catch(() => undefined);
          }}
        />
      );
    }
  }

  const isManual = ui.phase === 'manual-entry';
  const handleBack = () => {
    if (isManual) {
      if (initialPhase === 'manual') {
        navigation.goBack();
      } else {
        setUi({ phase: 'scanning' });
      }
    } else {
      navigation.goBack();
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <View style={[styles.topBar, { backgroundColor: theme.colors.bgElevated, borderBottomColor: theme.colors.border, paddingTop: insets.top + 10 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={handleBack} style={[styles.backButton, { backgroundColor: theme.colors.primaryLight }]}>
          <Ionicons name="arrow-back" size={20} color={theme.colors.primaryDark} />
        </Pressable>
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: theme.colors.primaryDark }]}>
            {isManual ? 'MANUALLY INPUT' : 'PANTRY SCAN'}
          </Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {isManual ? 'Manually Input' : 'Find your item'}
          </Text>
        </View>
      </View>

      {ui.phase === 'scanning' ? (
        <View style={styles.cameraContainer}>
          <ScanCamera onScan={handleScan} />
          <View pointerEvents="none" style={styles.guide}>
            <View style={[styles.frame, { borderColor: theme.colors.primary }]} />
            <View style={[styles.instruction, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderRadius: theme.radii.pill }]}>
              <Ionicons name="barcode-outline" size={18} color={theme.colors.primaryDark} />
              <Text style={[styles.instructionText, { color: theme.colors.text }]}>Center the barcode or QR code in the frame</Text>
            </View>
          </View>
          {target !== 'deal' ? (
            <View style={[styles.manualAddOverlay, { paddingBottom: insets.bottom + 16 }]}>
              <Pressable
                testID="scan-manual-add"
                accessibilityLabel="Manually input item. Fresh produce, bakery, wet market items"
                onPress={() => setUi({ phase: 'manual-entry' })}
                style={({ pressed }) => [
                  styles.manualAddButton,
                  {
                    backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                    borderColor: theme.colors.border,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]}
              >
                <View
                  style={[
                    styles.manualAddIconBadge,
                    { backgroundColor: theme.colors.primaryLight },
                  ]}
                >
                  <Ionicons name="create-outline" size={20} color={theme.colors.primaryDark} />
                </View>
                <View style={styles.manualAddContent}>
                  <Text style={[styles.manualAddTitle, { color: theme.colors.text }]}>
                    Manually Input
                  </Text>
                  <Text style={[styles.manualAddSubtext, { color: theme.colors.textMuted }]}>
                    Produce, bakery, wet market items
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {ui.phase === 'looking-up' ? (
        <View style={{ alignItems: 'center', marginTop: 24, gap: 12 }}>
          <View accessibilityLiveRegion="polite" style={[styles.loading, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderRadius: theme.radii.pill }]}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={{ color: theme.colors.text }}>Looking up item…</Text>
          </View>
          {target !== 'deal' ? (
            <Button
              testID="scan-cancel-to-manual"
              label="Cancel & Enter Manually"
              variant="ghost"
              onPress={cancelLookup}
            />
          ) : null}
        </View>
      ) : null}

      {ui.phase === 'under-review' ? (
        <View testID="scan-under-review" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <View style={[styles.panelIconBadge, { backgroundColor: theme.colors.accentLight }]}>
            <Ionicons name="time-outline" size={32} color={theme.colors.accent} />
          </View>
          <Text style={[styles.panelTitle, { color: theme.colors.text }]}>This item is awaiting review</Text>
          <Text style={[styles.panelBody, { color: theme.colors.textMuted }]}>
            This product was recently submitted and is awaiting community review. You can still track it privately in your pantry.
          </Text>
          {lastScanRef.current ? (
            <View style={[styles.codeBadge, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border }]}>
              <Ionicons name="barcode-outline" size={16} color={theme.colors.textMuted} />
              <Text style={[styles.codeText, { color: theme.colors.text }]}>{lastScanRef.current.value}</Text>
            </View>
          ) : null}
          <Button testID="scan-add-custom-item" label="Add as Private Item for My Pantry" onPress={() => setUi({ phase: 'under-review-custom-item' })} />
          <Button testID="scan-again" label="Scan again" variant="outline" onPress={scanAgain} />
        </View>
      ) : null}
      {ui.phase === 'manual-entry' ? (
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 80 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <AddRecordForm
            productId={null}
            scannedBarcode={lastScanRef.current?.kind === 'barcode' ? lastScanRef.current.value : undefined}
            lockedPersonalScope={Boolean(lastScanRef.current?.value)}
            onSaved={() => navigation.replace('Tabs')}
          />
        </KeyboardAwareScrollView>
      ) : null}

      {ui.phase === 'under-review-custom-item' ? (
        !customNameConfirmed ? (
          <View testID="scan-custom-item-form" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
            <Text style={[styles.panelTitle, { color: theme.colors.text }]}>Name this private item</Text>
            <Text style={[styles.panelBody, { color: theme.colors.textMuted }]}>
              Give this item a name to track its expiration date privately in your pantry.
            </Text>
            <TextInput
              accessibilityLabel="Custom item name"
              testID="scan-custom-item-name"
              style={[
                styles.customNameInput,
                { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.bgGlass },
              ]}
              placeholder="e.g. Frozen peas"
              placeholderTextColor={theme.colors.textMuted}
              value={customName}
              onChangeText={setCustomName}
              autoFocus
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
            <Button label="Back" variant="ghost" onPress={() => setUi({ phase: 'scanning' })} />
          </View>
        ) : (
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 80 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <AddRecordForm
              productId={null}
              customName={customName}
              scannedBarcode={lastScanRef.current?.kind === 'barcode' ? lastScanRef.current.value : undefined}
              lockedPersonalScope={Boolean(lastScanRef.current?.value)}
              onSaved={() => navigation.replace('Tabs')}
            />
          </KeyboardAwareScrollView>
        )
      ) : null}
      {ui.phase === 'not-found' ? (
        <View testID="scan-not-found" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <View style={[styles.panelIconBadge, { backgroundColor: theme.colors.primaryLight }]}>
            <Ionicons name="sparkles-outline" size={28} color={theme.colors.primaryDark} />
          </View>
          <Text style={[styles.panelTitle, { color: theme.colors.text }]}>We couldn't find this item</Text>
          <Text style={[styles.panelBody, { color: theme.colors.textMuted }]}>
            {target === 'deal'
              ? "This barcode isn't in our catalog yet. Add it as a new product to attach it to your deal."
              : "This barcode isn't in our catalog yet. You can add it as a new product with full details, or save it as a private item in your pantry."}
          </Text>
          {lastScanRef.current ? (
            <View style={[styles.codeBadge, { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border }]}>
              <Ionicons name="barcode-outline" size={16} color={theme.colors.textMuted} />
              <Text style={[styles.codeText, { color: theme.colors.text }]}>{lastScanRef.current.value}</Text>
            </View>
          ) : null}
          {ui.canCreate ? (
            <Button
              testID="scan-create"
              label={target === 'deal' ? 'Add Product & Continue Deal' : 'Add New Product'}
              icon="add"
              onPress={openCreate}
            />
          ) : (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>Creating new products isn't available right now.</Text>
          )}
          {target !== 'deal' ? (
            <Button
              testID="scan-add-custom-from-not-found"
              label="Add as Private Item for My Pantry"
              variant="outline"
              onPress={() => setUi({ phase: 'under-review-custom-item' })}
            />
          ) : null}
          <Button testID="scan-again" label="Scan again" variant="ghost" onPress={scanAgain} />
        </View>
      ) : null}
      {ui.phase === 'unavailable' ? (
        <View testID="scan-unavailable" style={[styles.resultPanel, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}>
          <View style={[styles.panelIconBadge, { backgroundColor: theme.colors.accentLight }]}>
            <Ionicons name="cloud-offline-outline" size={28} color={theme.colors.accent} />
          </View>
          <Text style={[styles.panelTitle, { color: theme.colors.text }]}>Lookup is temporarily unavailable</Text>
          <Text style={[styles.panelBody, { color: theme.colors.textMuted }]}>This isn't a "not found" — please check your connection and try again.</Text>
          <Button testID="scan-retry" label="Retry" onPress={retry} />
          {target !== 'deal' ? (
            <Button
              testID="scan-add-custom-from-unavailable"
              label="Add to Pantry Manually"
              variant="outline"
              onPress={() => setUi({ phase: 'under-review-custom-item' })}
            />
          ) : null}
          <Button testID="scan-again" label="Scan again" variant="outline" onPress={scanAgain} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: 'center', borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 12 },
  backButton: { alignItems: 'center', height: 42, justifyContent: 'center', width: 42, borderRadius: 21 },
  heading: { flex: 1 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  title: { fontSize: 17, fontWeight: '700', marginTop: 1 },
  cameraContainer: { flex: 1, position: 'relative', overflow: 'hidden' },
  guide: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { borderRadius: 22, borderWidth: 3, height: 220, width: 220 },
  instruction: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 8, marginTop: 20, paddingHorizontal: 16, paddingVertical: 10 },
  instructionText: { fontSize: 13, fontWeight: '600' },
  loading: { alignItems: 'center', borderWidth: 1, flexDirection: 'row', gap: 10, alignSelf: 'center', marginTop: 24, paddingHorizontal: 16, paddingVertical: 10 },
  resultPanel: {
    borderWidth: 1,
    borderRadius: 20,
    gap: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    alignItems: 'center',
  },
  panelIconBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  panelBody: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 320,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  customNameInput: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  manualAddOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    alignItems: 'center',
  },
  manualAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  manualAddIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualAddContent: {
    flex: 1,
    gap: 2,
  },
  manualAddTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  manualAddSubtext: {
    fontSize: 12,
  },
});
