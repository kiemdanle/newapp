import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { Product } from '@expyrico/shared';
import { useCreateOrResumeDraft, useProduct } from '../../../src/api/products';
import { ProductDraftForm } from '../../../src/features/products/ProductDraftForm';
import { DraftEditor } from '../../../src/features/products/DraftEditor';
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
 * record until it's been abuse-verified through submission (Task 7) — so a
 * freshly created or edited draft only offers Save/Submit here, and only
 * moves to the personal-pantry continuation once submission clears. Both the
 * `pending` (already submitted, awaiting review) and freshly-submitted cases
 * attach with `lockedPersonalScope`: the product is still private
 * (non-`active`) until an admin approves it, so it can never join a shared
 * household pantry before then.
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
  const [submittedProduct, setSubmittedProduct] = useState<Product | null>(null);

  const productId = routeProductId ?? createdProductId;
  const { data: product, isLoading } = useProduct(productId ?? undefined);

  // Dirty-fields navigation guard: a swipe-back/hardware-back mid-edit
  // prompts rather than silently discarding unsaved text.
  // M8: React Navigation requires a memoized callback here — an inline
  // arrow, as this was, tears down and re-registers the `beforeRemove`
  // listener on every render. The project's own `useFocusEffect` test mock
  // (`tests/setup.ts`) can't catch this (it ignores callback identity and
  // just runs the effect once), so this only ever showed up on review.
  useFocusEffect(
    useCallback(() => {
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation]),
  );

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

  // A submission just cleared in this session: continue straight to the
  // personal-pantry form, locked to personal scope since the product is
  // still `pending` (private) until an admin approves it.
  if (submittedProduct) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Text testID="new-product-submitted-message" style={{ color: theme.colors.text, fontWeight: '600' }}>
            Submitted for review — you can add it to your pantry now.
          </Text>
        </View>
        <AddRecordForm
          productId={submittedProduct.id}
          productName={submittedProduct.name}
          lockedPersonalScope
          onSaved={async () => {
            await ensurePushTokenRegistered();
            navigation.reset({ index: 0, routes: [{ name: 'Tabs' as never }] });
          }}
        />
      </ScrollView>
    );
  }

  // resume === 'pending': already-submitted draft, read-only metadata plus
  // the personal-pantry continuation the spec allows for pending products.
  // Still private (non-`active`) until approved, so scope stays locked here too.
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
          lockedPersonalScope
          onSaved={async () => {
            await ensurePushTokenRegistered();
            navigation.reset({ index: 0, routes: [{ name: 'Tabs' as never }] });
          }}
        />
      </ScrollView>
    );
  }

  // resume === 'edit' (or a freshly created draft): editable metadata,
  // photos, and submit.
  if (product) {
    const discardDraft = async () => {
      if (userId) await removeDraftLocalState(userId, { barcode: barcode || null, qr: qr || null });
      dirtyRef.current = false;
      setDirty(false);
      navigation.goBack();
    };

    const handleSubmitted = async (submitted: Product) => {
      if (userId) await removeDraftLocalState(userId, { barcode: barcode || null, qr: qr || null });
      dirtyRef.current = false;
      setDirty(false);
      setSubmittedProduct(submitted);
    };

    return (
      <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
        <DraftEditor
          product={product}
          feedback={feedback}
          onDirtyChange={setDirty}
          onDiscard={discardDraft}
          onSubmitted={handleSubmitted}
        />
      </ScrollView>
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
