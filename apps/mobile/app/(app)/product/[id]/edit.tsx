import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { ProductEditRow } from '@expyrico/shared';
import { useProduct } from '../../../../src/api/products';
import { useCreateOrResumeEdit } from '../../../../src/api/product-edits';
import { EditEditor } from '../../../../src/features/products/EditEditor';
import { ProductEditForm } from '../../../../src/features/products/ProductEditForm';
import { useTheme } from '../../../../src/theme/useTheme';
import { Screen } from '../../../../src/components/Screen';

/**
 * Creator-facing "Suggest an edit" flow for an already-active product. Not
 * gated by `product_creation` mode (plan.md) — any authenticated user may
 * open this. Creates or resumes the caller's own open revision on mount,
 * then branches on its status: `draft`/`changes_required` gets the full
 * editable surface (EditEditor); `pending` gets a read-only summary, since
 * nothing here is mutable again until an admin resolves it. The live
 * product's public data never changes as a result of anything on this
 * screen — approval is Phase 4's admin-only path.
 */
export default function ProductEditScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { id: productId } = route.params as { id: string };

  const { data: product, isLoading: productLoading } = useProduct(productId);
  const createOrResumeEdit = useCreateOrResumeEdit();
  const [edit, setEdit] = useState<ProductEditRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const requestedRef = useRef(false);

  useEffect(() => {
    if (requestedRef.current || !product) return;
    requestedRef.current = true;
    createOrResumeEdit.mutate(productId, {
      onSuccess: (row) => setEdit(row),
      onError: (e) => setCreateError((e as Error).message),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, productId]);

  // Dirty-fields navigation guard, same pattern as product/new.tsx. M8:
  // memoized, same reason — React Navigation requires it, and an inline
  // arrow re-registers the listener every render.
  useFocusEffect(
    useCallback(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
        if (!dirtyRef.current) return;
        e.preventDefault();
        Alert.alert("Discard unsaved changes?", "Your edits to this suggestion haven't been saved.", [
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              dirtyRef.current = false;
              setDirty(false);
              // @ts-expect-error — generic NavigationProp gap, same as product/new.tsx.
              navigation.dispatch(e.data.action);
            },
          },
        ]);
      });
      return unsubscribe;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation]),
  );

  if (productLoading || (!edit && !createError)) {
    return (
      <Screen>
        <Text style={{ color: theme.colors.textMuted }}>Loading…</Text>
      </Screen>
    );
  }

  if (createError || !product) {
    return (
      <Screen>
        <Text testID="edit-load-error" style={{ color: theme.colors.danger }}>
          {createError ?? 'This product is not available to edit.'}
        </Text>
      </Screen>
    );
  }

  const liveProduct = { name: product.name, description: product.description, brand: product.brand, category: product.category };

  if (edit!.status === 'pending') {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
          <Text testID="edit-pending-message" style={{ color: theme.colors.textMuted }}>
            Your suggested edit is awaiting review.
          </Text>
          <ProductEditForm initialEdit={edit!} liveProduct={liveProduct} readOnly />
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
      <EditEditor
        productId={productId}
        liveProduct={liveProduct}
        edit={edit!}
        onDirtyChange={setDirty}
        onSubmitted={() => {
          dirtyRef.current = false;
          setDirty(false);
          navigation.goBack();
        }}
      />
    </ScrollView>
  );
}
