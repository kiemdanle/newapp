import { useEffect, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import type { Product } from '@expyrico/shared';
import { isApiError } from '../../api/errors';
import { usePatchDraft } from '../../api/products';
import { apiClient } from '../../api/client';
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

function fieldsFrom(product: Product): Fields {
  return {
    name: product.name,
    description: product.description ?? '',
    brand: product.brand ?? '',
    category: product.category ?? '',
  };
}

function fieldsEqual(a: Fields, b: Fields): boolean {
  return a.name === b.name && a.description === b.description && a.brand === b.brand && a.category === b.category;
}

export interface ProductDraftFormProps {
  initialProduct: Product;
  onSaved?: (product: Product) => void;
  onDirtyChange?: (dirty: boolean) => void;
  readOnly?: boolean;
  /** Rendered above the fields — used by the drafts screen to surface
   * `moderationFeedback` for a `changes_required` row. */
  feedbackBanner?: React.ReactNode;
  /** When provided, metadata saves route through the same serialized queue
   * as the photo editor mounted alongside this form (Task 7) instead of
   * issuing an independent PATCH — required so the two never race for the
   * same product `version`. Omitted for the read-only pending view, which
   * never saves at all. */
  coordinator?: DraftMutationCoordinator<Product>;
}

/** The identifier (barcode/QR) is immutable and shown read-only — it's the
 * one field this form never lets the creator change, since it's the key the
 * whole draft/resume flow is keyed by. */
export function ProductDraftForm({ initialProduct, onSaved, onDirtyChange, readOnly, feedbackBanner, coordinator }: ProductDraftFormProps) {
  const theme = useTheme();
  const patchDraft = usePatchDraft();
  const [known, setKnown] = useState(initialProduct);
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(initialProduct));
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ currentVersion: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const dirty = !fieldsEqual(fields, fieldsFrom(known));

  useEffect(() => {
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  // Coordinator conflicts arrive asynchronously (a photo mutation can also
  // trigger one) — subscribe rather than only checking after this form's own
  // save, so a conflict raised elsewhere still surfaces here.
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
    if (!fields.name.trim()) {
      setError('Name is required');
      return;
    }
    setError(null);
    setConflict(null);
    const patch = {
      name: fields.name.trim(),
      description: fields.description.trim() || null,
      brand: fields.brand.trim() || null,
      category: fields.category.trim() || null,
    };
    setSaving(true);
    try {
      const updated = coordinator
        ? await coordinator.enqueue({ kind: 'metadata', fields: patch })
        : await patchDraft.mutateAsync({ id: known.id, version: known.version, ...patch });
      setKnown(updated);
      setFields(fieldsFrom(updated));
      onSaved?.(updated);
    } catch (e) {
      if (isApiError(e) && e.code === 'version_conflict') {
        // Never overwrite what the creator typed — only surface the conflict
        // and let them explicitly choose to refresh.
        setConflict({ currentVersion: e.currentVersion ?? known.version });
        return;
      }
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Non-coordinator path only: a plain refetch that preserves dirty text —
  // the coordinator path below uses reconcileConflict() instead, which also
  // resolves the save() promise still pending from the conflicting attempt.
  const refreshFromServer = async () => {
    setRefreshing(true);
    try {
      const fresh = await apiClient.get<Product>(`/products/${known.id}`);
      setKnown(fresh);
      setConflict(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const reconcile = async (resolution: 'retry' | 'discard-local') => {
    if (!coordinator) return;
    setRefreshing(true);
    try {
      const resolved = await coordinator.reconcileConflict(resolution);
      setKnown(resolved);
      if (resolution === 'discard-local') setFields(fieldsFrom(resolved));
      setConflict(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefreshing(false);
    }
  };

  const isSaving = coordinator ? saving : patchDraft.isPending;

  const input = {
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
  } as const;

  return (
    <View style={{ gap: theme.spacing.md }}>
      {feedbackBanner}

      <Text style={{ color: theme.colors.textMuted }}>Identifier</Text>
      <Text testID="draft-identifier" style={{ color: theme.colors.text }}>
        {known.barcode ?? known.qrPayload ?? '—'}
      </Text>

      <Text style={{ color: theme.colors.textMuted }}>Name</Text>
      <TextInput
        accessibilityLabel="Name"
        testID="draft-name"
        editable={!readOnly}
        style={input}
        value={fields.name}
        maxLength={NAME_MAX}
        onChangeText={(v) => setFields((f) => ({ ...f, name: v }))}
      />

      <Text style={{ color: theme.colors.textMuted }}>Description (optional)</Text>
      <TextInput
        accessibilityLabel="Description"
        testID="draft-description"
        editable={!readOnly}
        style={[input, { minHeight: 80 }]}
        value={fields.description}
        maxLength={DESCRIPTION_MAX}
        multiline
        onChangeText={(v) => setFields((f) => ({ ...f, description: v }))}
      />
      <Text testID="draft-description-counter" style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {fields.description.length}/{DESCRIPTION_MAX}
      </Text>

      {/* 2-Column Row for Brand & Category */}
      <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Brand (optional)</Text>
          <TextInput
            accessibilityLabel="Brand"
            testID="draft-brand"
            editable={!readOnly}
            style={input}
            value={fields.brand}
            onChangeText={(v) => setFields((f) => ({ ...f, brand: v }))}
          />
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, fontWeight: '600' }}>Category (optional)</Text>
          <TextInput
            accessibilityLabel="Category"
            testID="draft-category"
            editable={!readOnly}
            style={input}
            value={fields.category}
            onChangeText={(v) => setFields((f) => ({ ...f, category: v }))}
          />
        </View>
      </View>

      {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}

      {conflict ? (
        <DraftConflictBanner
          currentVersion={conflict.currentVersion}
          mode={coordinator ? 'coordinator' : 'refresh-only'}
          busy={refreshing}
          onRetry={coordinator ? () => reconcile('retry') : refreshFromServer}
          onDiscard={coordinator ? () => reconcile('discard-local') : undefined}
        />
      ) : null}

      {!readOnly ? (
        <Button
          testID="draft-save"
          label={isSaving ? 'Saving…' : 'Save'}
          loading={isSaving}
          disabled={!dirty || Boolean(conflict)}
          onPress={save}
        />
      ) : null}
    </View>
  );
}
