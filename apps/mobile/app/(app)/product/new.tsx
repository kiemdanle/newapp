import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, View, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Product } from '@expyrico/shared';
import { apiClient } from '../../../src/api/client';
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
  target?: 'pantry' | 'deal';
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
  const insets = useSafeAreaInsets();
  const { barcode, qr, productId: routeProductId, resume, feedback, target } = (route.params ?? {}) as RouteParams;
  const userId = useSessionStore((s) => s.user?.id);

  const createOrResumeDraft = useCreateOrResumeDraft();
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [nameFocused, setNameFocused] = useState(false);
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
  const handleClose = () => {
    if (dirtyRef.current) {
      Alert.alert('Discard unsaved changes?', "Your edits to this product haven't been saved.", [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            dirtyRef.current = false;
            setDirty(false);
            navigation.goBack();
          },
        },
      ]);
    } else {
      navigation.goBack();
    }
  };

  const createDraft = async () => {
    if (!name.trim()) {
      setCreateError('Name is required');
      return;
    }
    setCreateError(null);
    try {
      const payload = barcode
        ? { barcode: barcode.trim() }
        : qr
          ? { qrPayload: qr.trim() }
          : { barcode: undefined };
      const { product: created } = await createOrResumeDraft.mutateAsync(payload);
      // Patch the initial name entered by the user
      try {
        await apiClient.patch<Product>(`/products/drafts/${created.id}`, {
          version: created.version,
          name: name.trim(),
        });
      } catch {
        // Fall through to local state if server patch rejects
      }
      setCreatedProductId(created.id);
      if (userId) {
        await saveDraftLocalState(userId, {
          productId: created.id,
          identifier: { barcode: barcode ? barcode.trim() : null, qr: qr ? qr.trim() : null },
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
            This product is awaiting review. {target === 'deal' ? 'You can use it to post your deal now.' : 'You can still add it to your pantry now.'}
          </Text>
          <ProductDraftForm initialProduct={product} readOnly />
          {target === 'deal' ? (
            <Button
              testID="use-pending-product-for-deal"
              label="Use for Deal"
              icon="arrow-forward"
              onPress={() => {
                // @ts-expect-error navigation to DealNew
                navigation.navigate('DealNew', { productId: product.id });
              }}
            />
          ) : null}
        </View>
        {target !== 'deal' ? (
          <AddRecordForm
            productId={product.id}
            productName={product.name}
            lockedPersonalScope
            onSaved={async () => {
              await ensurePushTokenRegistered();
              navigation.reset({ index: 0, routes: [{ name: 'Tabs' as never }] });
            }}
          />
        ) : null}
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
      if (target === 'deal') {
        // @ts-expect-error navigation to DealNew
        navigation.navigate('DealNew', { productId: submitted.id });
        return;
      }
      setSubmittedProduct(submitted);
    };

    return (
      <View style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
        {/* Persistent Top Navigation Bar */}
        <View
          style={[
            styles.topBar,
            {
              backgroundColor: theme.colors.bgElevated,
              borderBottomColor: theme.colors.border,
              paddingTop: insets.top + 8,
            },
          ]}
        >
          <Pressable
            testID="product-new-close-btn"
            accessibilityRole="button"
            accessibilityLabel="Close product editor"
            onPress={handleClose}
            style={[styles.closeBtn, { backgroundColor: theme.colors.bgGlass }]}
          >
            <Ionicons name="close" size={20} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>Product Details</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Done"
            onPress={handleClose}
            hitSlop={8}
          >
            <Text style={[styles.doneBtnText, { color: theme.colors.primaryDark }]}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
          <DraftEditor
            product={product}
            feedback={feedback}
            onDirtyChange={setDirty}
            onDiscard={discardDraft}
            onSubmitted={handleSubmitted}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.bg }]}>
      {/* Persistent Top Navigation Bar */}
      <View
        style={[
          styles.topBar,
          {
            backgroundColor: theme.colors.bgElevated,
            borderBottomColor: theme.colors.border,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <Pressable
          testID="product-new-close-btn"
          accessibilityRole="button"
          accessibilityLabel="Close new product"
          onPress={handleClose}
          style={[styles.closeBtn, { backgroundColor: theme.colors.bgGlass }]}
        >
          <Ionicons name="close" size={20} color={theme.colors.text} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: theme.colors.text }]}>New Product</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          onPress={handleClose}
          hitSlop={8}
        >
          <Text style={[styles.doneBtnText, { color: theme.colors.primaryDark }]}>Cancel</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.lg }}
      >
      {/* Step Indicator Header */}
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }} />
          <Text style={{ color: theme.colors.primaryDark, fontSize: 12, fontWeight: '700', letterSpacing: 0.8 }}>
            STEP 1 OF 2 · BASIC INFO
          </Text>
        </View>
        <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.headlineSmall.fontSize, fontWeight: '700' }}>
          Add a new product
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 }}>
          Enter the product name to get started. You'll be able to upload photos, add brand, and fill details on the next step.
        </Text>
      </View>

      {/* Scanned Identifier Card */}
      {barcode || qr ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderWidth: 1.5,
            borderRadius: theme.radii.lg,
            padding: 14,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: theme.colors.primaryLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={barcode ? 'barcode-outline' : 'qr-code-outline'} size={22} color={theme.colors.primaryDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>
                {barcode ? 'SCANNED BARCODE' : 'SCANNED QR CODE'}
              </Text>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '700', fontFamily: 'monospace', marginTop: 2 }}>
                {barcode || qr}
              </Text>
            </View>
          </View>
          <View style={{ backgroundColor: theme.colors.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ color: theme.colors.primaryDark, fontSize: 11, fontWeight: '700' }}>Verified</Text>
          </View>
        </View>
      ) : null}

      {/* Name Input Card */}
      <View
        style={{
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderWidth: 1.5,
          borderRadius: theme.radii.lg,
          padding: 18,
          gap: 12,
          shadowColor: theme.colors.neutralDark,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.05,
          shadowRadius: 6,
          elevation: 2,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="pricetag-outline" size={16} color={theme.colors.primary} />
          <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '700' }}>Product Name *</Text>
        </View>
        <View
          style={{
            backgroundColor: nameFocused ? (theme.scheme === 'dark' ? '#202924' : '#FFFFFF') : (theme.scheme === 'dark' ? '#161C18' : '#F6F6F4'),
            borderColor: nameFocused ? theme.colors.primary : theme.colors.border,
            borderWidth: 1.5,
            borderRadius: theme.radii.md,
            minHeight: 52,
            justifyContent: 'center',
            paddingHorizontal: 14,
          }}
        >
          <TextInput
            accessibilityLabel="Text input field"
            testID="new-product-name"
            style={{
              color: theme.colors.text,
              fontSize: 16,
              paddingVertical: 10,
            }}
            placeholder="e.g. Organic Almond Milk"
            placeholderTextColor={theme.colors.textMuted}
            value={name}
            onChangeText={setName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            autoFocus
          />
        </View>
        {createError ? <Text style={{ color: theme.colors.danger, fontSize: 13 }}>{createError}</Text> : null}
      </View>
      {/* Continue CTA */}
      <Button
        testID="new-product-create"
        label="Continue to photos & details"
        icon="arrow-forward"
        onPress={createDraft}
        loading={createOrResumeDraft.isPending}
      />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
});
