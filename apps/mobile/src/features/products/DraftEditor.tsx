import { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Product } from '@expyrico/shared';
import { createProductDraftCoordinatorAdapter } from '../../api/products';
import { createDraftMutationCoordinator } from './draft-mutation-coordinator';
import { ProductDraftForm } from './ProductDraftForm';
import { ProductPhotoEditor } from './ProductPhotoEditor';
import { DraftSubmitPanel } from './DraftSubmitPanel';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';

export interface DraftEditorProps {
  product: Product;
  feedback?: string;
  onDirtyChange: (dirty: boolean) => void;
  onDiscard: () => void;
  onSubmitted: (product: Product) => void;
}

/**
 * The editable metadata + photo + submit surface for a `draft`/
 * `changes_required` product. Owns the one `DraftMutationCoordinator`
 * instance this editing session uses — `ProductDraftForm`'s metadata saves
 * and `ProductPhotoEditor`'s photo mutations both funnel through it, so they
 * never race for the product's `version` (Phase 5 Task 7's real gap: Tasks
 * 4-6 built each piece against its own fake, but nothing had wired a live
 * coordinator into the actual screen yet).
 */
export function DraftEditor({ product, feedback, onDirtyChange, onDiscard, onSubmitted }: DraftEditorProps) {
  const theme = useTheme();

  // One coordinator per product id, not per `product` object identity — a
  // background refetch of the underlying React Query cache must not reset
  // the coordinator's own authoritative in-session state.
  const coordinatorRef = useRef<{ id: string; coordinator: ReturnType<typeof createDraftMutationCoordinator<Product>> } | null>(null);
  if (!coordinatorRef.current || coordinatorRef.current.id !== product.id) {
    coordinatorRef.current = {
      id: product.id,
      coordinator: createDraftMutationCoordinator(createProductDraftCoordinatorAdapter(product.id), product),
    };
  }
  const coordinator = coordinatorRef.current.coordinator;

  const [formDirty, setFormDirty] = useState(false);
  const [photoUnsettled, setPhotoUnsettled] = useState(false);

  useEffect(() => {
    onDirtyChange(formDirty || photoUnsettled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formDirty, photoUnsettled]);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      {/* Step 2 Header */}
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary }} />
          <Text style={{ color: theme.colors.primaryDark, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>
            STEP 2 OF 2 · DETAILS & PHOTOS
          </Text>
        </View>
        <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '800' }}>
          Product Details & Photos
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
          Upload photos and adjust metadata before submitting for community catalog review.
        </Text>
      </View>

      <ProductDraftForm
        initialProduct={product}
        coordinator={coordinator}
        onDirtyChange={setFormDirty}
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
      <ProductPhotoEditor
        target={{ kind: 'draft', productId: product.id }}
        coordinator={coordinator}
        onUnsettledChange={setPhotoUnsettled}
      />
      <DraftSubmitPanel coordinator={coordinator} disabled={formDirty || photoUnsettled} onSubmitted={onSubmitted} />
      <Button testID="new-product-discard" label="Discard draft" variant="outline" onPress={onDiscard} />
    </View>
  );
}
