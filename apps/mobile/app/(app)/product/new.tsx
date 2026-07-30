import { useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useCreateOrResumeDraft, useProduct } from '../../../src/api/products';
import { ProductDraftForm } from '../../../src/features/products/ProductDraftForm';
import { AddRecordForm } from '../../../src/features/records/AddRecordForm';
import { useSessionStore } from '../../../src/auth/session-store';
import { saveDraftLocalState, removeDraftLocalState } from '../../../src/features/products/product-draft-storage';
import { ensurePushTokenRegistered } from '../../../src/features/push/registerPushToken';
import { useTheme } from '../../../src/theme/useTheme';
import { Screen } from '../../../src/components/Screen';
import { Button } from '../../../src/components/Button';

type RouteParams = {
  barcode?: string;
  qr?: string;
  productId?: string;
  resume?: 'edit' | 'pending';
  feedback?: string;
};

/**
 * A creator's draft/changes_required product isn't attachable to a personal
 * record until it's been abuse-verified through submission (Phase 5 Task 7,
 * not this screen) — so a freshly created or edited draft only offers Save
 * here. `resume === 'pending'` means the draft already cleared submission,
 * so it's exactly the case plan.md allows attaching to a new personal
 * record immediately.
 */
export default function NewProductScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { barcode, qr, productId: routeProductId, resume, feedback } = (route.params ?? {}) as RouteParams;
  const userId = useSessionStore((s) => s.user?.id);

  const createOrResumeDraft = useCreateOrResumeDraft();
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const productId = routeProductId ?? createdProductId;
  const { data: product, isLoading } = useProduct(productId ?? undefined);

  // Dirty-fields navigation guard: a swipe-back/hardware-back mid-edit
  // prompts rather than silently discarding unsaved text.
  useFocusEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      Alert.alert("Discard unsaved changes?", "Your edits to this product haven't been saved.", [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            dirtyRef.current = false;
            setDirty(false);
            // @ts-expect-error — same generic-NavigationProp gap as above.
            navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  });

  const createDraft = async () => {
    if (!name.trim()) {
      setCreateError('Name is required');
      return;
    }
    setCreateError(null);
    try {
      const { product: created } = await createOrResumeDraft.mutateAsync({
        barcode: barcode || null,
        qrPayload: qr || null,
      });
      setCreatedProductId(created.id);
      if (userId) {
        await saveDraftLocalState(userId, {
          productId: created.id,
          identifier: { barcode: barcode || null, qr: qr || null },
          dirty: { name: name.trim() },
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (e) {
      setCreateError((e as Error).message);
    }
  };

  if (isLoading && productId) {
    return (
      <Screen>
        <Text style={{ color: theme.colors.textMuted }}>Loading…</Text>
      </Screen>
    );
  }

  // resume === 'pending': already-submitted draft, read-only metadata plus
  // the personal-pantry continuation the spec allows for pending products.
  if (product && resume === 'pending') {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Text style={{ color: theme.colors.textMuted }}>
            This product is awaiting review. You can still add it to your pantry now.
          </Text>
          <ProductDraftForm initialProduct={product} readOnly />
        </View>
        <AddRecordForm
          productId={product.id}
          productName={product.name}
          onSaved={async () => {
            await ensurePushTokenRegistered();
            navigation.reset({ index: 0, routes: [{ name: 'Tabs' as never }] });
          }}
        />
      </ScrollView>
    );
  }

  // resume === 'edit' (or a freshly created draft): editable metadata form.
  if (product) {
    const discardDraft = async () => {
      if (userId) await removeDraftLocalState(userId, { barcode: barcode || null, qr: qr || null });
      dirtyRef.current = false;
      setDirty(false);
      navigation.goBack();
    };

    return (
      <Screen>
        <ProductDraftForm
          initialProduct={product}
          onDirtyChange={setDirty}
          feedbackBanner={
            feedback ? (
              <View
                testID="new-product-feedback"
                style={{ backgroundColor: theme.colors.bgGlass, borderRadius: theme.radii.md, padding: theme.spacing.md }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Changes requested</Text>
                <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>{feedback}</Text>
              </View>
            ) : undefined
          }
        />
        <Button testID="new-product-discard" label="Discard draft" variant="outline" onPress={discardDraft} />
      </Screen>
    );
  }

  // No draft yet: name-only quick creation, matching the spec's minimal
  // "reserve the identifier" step before the full editor opens.
  const input = {
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  } as const;

  return (
    <ScrollView
      contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md, backgroundColor: theme.colors.bg }}
    >
      <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.headlineSmall.fontSize, fontWeight: theme.typeRamp.headlineSmall.fontWeight as never }}>
        Add a product
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>Give it a clear name so your pantry stays easy to scan.</Text>
      {barcode ? <Text style={{ color: theme.colors.textMuted }}>Barcode: {barcode}</Text> : null}
      {qr ? <Text style={{ color: theme.colors.textMuted }}>QR: {qr}</Text> : null}
      <Text style={{ color: theme.colors.textMuted }}>Name</Text>
      <TextInput accessibilityLabel="Text input field" testID="new-product-name" style={input} value={name} onChangeText={setName} />
      {createError ? <Text style={{ color: theme.colors.danger }}>{createError}</Text> : null}
      <Button testID="new-product-create" label="Continue" icon="arrow-forward" onPress={createDraft} loading={createOrResumeDraft.isPending} />
    </ScrollView>
  );
}
