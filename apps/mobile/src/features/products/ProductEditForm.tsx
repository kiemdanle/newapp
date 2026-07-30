import { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import type { Product, ProductEditRow } from '@expyrico/shared';
import type { DraftMutationCoordinator } from './draft-mutation-coordinator';
import { DraftConflictBanner } from './DraftConflictBanner';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

interface Fields {
  name: string;
  description: string;
  brand: string;
  category: string;
}

function fieldsFrom(edit: ProductEditRow): Fields {
  return {
    name: edit.name,
    description: edit.description ?? '',
    brand: edit.brand ?? '',
    category: edit.category ?? '',
  };
}

function fieldsEqual(a: Fields, b: Fields): boolean {
  return a.name === b.name && a.description === b.description && a.brand === b.brand && a.category === b.category;
}

export interface ProductEditFormProps {
  initialEdit: ProductEditRow;
  /** The live product's current published values — rendered as a small
   * "Live: …" caption under any field the proposal actually changes, so the
   * creator can see the live-vs-proposed boundary plan.md requires without a
   * full diff view. */
  liveProduct: Pick<Product, 'name' | 'description' | 'brand' | 'category'>;
  /** Omitted (with `readOnly`) for a `pending` revision — there is nothing
   * to save until an admin resolves it, so no coordinator is created for
   * that view. */
  coordinator?: DraftMutationCoordinator<ProductEditRow>;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
}

function LiveCaption({ live, proposed }: { live: string | null; proposed: string }) {
  const theme = useTheme();
  const liveText = live ?? '—';
  if (liveText === (proposed || '—')) return null;
  return <Text style={{ color: theme.colors.textMuted, fontSize: 11 }}>Live: {liveText}</Text>;
}

export function ProductEditForm({ initialEdit, liveProduct, coordinator, onDirtyChange, readOnly }: ProductEditFormProps) {
  const theme = useTheme();
  const [known, setKnown] = useState(initialEdit);
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(initialEdit));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ currentVersion: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reconciling, setReconciling] = useState(false);

  const dirty = !fieldsEqual(fields, fieldsFrom(known));

  useEffect(() => {
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  useEffect(() => {
    if (!coordinator) return;
    if (coordinator.hasConflict()) setConflict({ currentVersion: known.version });
    return coordinator.onConflict((info) => {
      setKnown(info.serverEntity);
      setConflict({ currentVersion: info.currentVersion });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinator]);

  const save = async () => {
    if (!coordinator) return;
    if (!fields.name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    setConflict(null);
    setSaving(true);
    try {
      const updated = await coordinator.enqueue({
        kind: 'metadata',
        fields: {
          name: fields.name.trim(),
          description: fields.description.trim() || null,
          brand: fields.brand.trim() || null,
          category: fields.category.trim() || null,
        },
      });
      setKnown(updated);
      setFields(fieldsFrom(updated));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const reconcile = async (resolution: 'retry' | 'discard-local') => {
    if (!coordinator) return;
    setReconciling(true);
    try {
      const resolved = await coordinator.reconcileConflict(resolution);
      setKnown(resolved);
      if (resolution === 'discard-local') setFields(fieldsFrom(resolved));
      setConflict(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReconciling(false);
    }
  };

  const input = {
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  } as const;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {known.status === 'changes_required' && known.moderationFeedback ? (
        <View
          testID="edit-feedback"
          style={{ backgroundColor: theme.colors.bgGlass, borderRadius: theme.radii.md, padding: theme.spacing.md }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Changes requested</Text>
          <Text style={{ color: theme.colors.textMuted, marginTop: 4 }}>{known.moderationFeedback}</Text>
        </View>
      ) : null}

      <Text style={{ color: theme.colors.textMuted }}>Name</Text>
      <TextInput
        accessibilityLabel="Name"
        testID="edit-name"
        editable={!readOnly}
        style={input}
        value={fields.name}
        maxLength={NAME_MAX}
        onChangeText={(v) => setFields((f) => ({ ...f, name: v }))}
      />
      <LiveCaption live={liveProduct.name} proposed={fields.name} />

      <Text style={{ color: theme.colors.textMuted }}>Description (optional)</Text>
      <TextInput
        accessibilityLabel="Description"
        testID="edit-description"
        editable={!readOnly}
        style={[input, { minHeight: 80 }]}
        value={fields.description}
        maxLength={DESCRIPTION_MAX}
        multiline
        onChangeText={(v) => setFields((f) => ({ ...f, description: v }))}
      />
      <Text testID="edit-description-counter" style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {fields.description.length}/{DESCRIPTION_MAX}
      </Text>
      <LiveCaption live={liveProduct.description} proposed={fields.description} />

      <Text style={{ color: theme.colors.textMuted }}>Brand (optional)</Text>
      <TextInput
        accessibilityLabel="Brand"
        testID="edit-brand"
        editable={!readOnly}
        style={input}
        value={fields.brand}
        onChangeText={(v) => setFields((f) => ({ ...f, brand: v }))}
      />
      <LiveCaption live={liveProduct.brand} proposed={fields.brand} />

      <Text style={{ color: theme.colors.textMuted }}>Category (optional)</Text>
      <TextInput
        accessibilityLabel="Category"
        testID="edit-category"
        editable={!readOnly}
        style={input}
        value={fields.category}
        onChangeText={(v) => setFields((f) => ({ ...f, category: v }))}
      />
      <LiveCaption live={liveProduct.category} proposed={fields.category} />

      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}

      {conflict ? (
        <DraftConflictBanner
          currentVersion={conflict.currentVersion}
          mode="coordinator"
          busy={reconciling}
          onRetry={() => reconcile('retry')}
          onDiscard={() => reconcile('discard-local')}
        />
      ) : null}

      {!readOnly ? (
        <Button
          testID="edit-save"
          label={saving ? 'Saving…' : 'Save'}
          loading={saving}
          disabled={!dirty || Boolean(conflict)}
          onPress={save}
        />
      ) : null}
    </View>
  );
}
