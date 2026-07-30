import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import type { Product, ProductEditRow } from '@expyrico/shared';
import { createProductEditCoordinatorAdapter } from '../../api/product-edits';
import { createDraftMutationCoordinator } from './draft-mutation-coordinator';
import { ProductEditForm } from './ProductEditForm';
import { ProductPhotoEditor } from './ProductPhotoEditor';
import { EditSubmitPanel } from './EditSubmitPanel';
import { useTheme } from '../../theme/useTheme';

export interface EditEditorProps {
  productId: string;
  liveProduct: Pick<Product, 'name' | 'description' | 'brand' | 'category'>;
  edit: ProductEditRow;
  onDirtyChange: (dirty: boolean) => void;
  onSubmitted: (edit: ProductEditRow) => void;
}

/**
 * The editable metadata + photo + submit surface for an open (`draft`/
 * `changes_required`) product revision — the edit-scoped mirror of
 * `DraftEditor.tsx`. Owns the one coordinator instance this editing session
 * uses, targeting `/product-edits/:editId/*` routes instead of the draft
 * product routes, so metadata and photo mutations here never race for the
 * edit's own `version` (same rationale as the draft editor).
 */
export function EditEditor({ productId, liveProduct, edit, onDirtyChange, onSubmitted }: EditEditorProps) {
  const theme = useTheme();

  const coordinatorRef = useRef<{ id: string; coordinator: ReturnType<typeof createDraftMutationCoordinator<ProductEditRow>> } | null>(null);
  if (!coordinatorRef.current || coordinatorRef.current.id !== edit.id) {
    coordinatorRef.current = {
      id: edit.id,
      coordinator: createDraftMutationCoordinator(createProductEditCoordinatorAdapter(productId, edit.id), edit),
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
      <ProductEditForm initialEdit={edit} liveProduct={liveProduct} coordinator={coordinator} onDirtyChange={setFormDirty} />
      <ProductPhotoEditor
        target={{ kind: 'product_edit', editId: edit.id }}
        coordinator={coordinator}
        onUnsettledChange={setPhotoUnsettled}
      />
      <EditSubmitPanel coordinator={coordinator} disabled={formDirty || photoUnsettled} onSubmitted={onSubmitted} />
    </View>
  );
}
