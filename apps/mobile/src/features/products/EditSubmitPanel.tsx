import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { ProductEditRow } from '@expyrico/shared';
import { useSubmitEdit } from '../../api/product-edits';
import { isApiError } from '../../api/errors';
import { newIdempotencyKey } from '../../lib/idempotency';
import type { DraftMutationCoordinator } from './draft-mutation-coordinator';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';

export interface EditSubmitPanelProps {
  coordinator: DraftMutationCoordinator<ProductEditRow>;
  /** True while metadata text is unsaved or a photo upload is in flight. */
  disabled?: boolean;
  onSubmitted: (edit: ProductEditRow) => void;
}

/**
 * Flushes any pending metadata and submits the revision. Unlike a draft
 * submit, no abuse token is minted — active revisions aren't gated by
 * `product_creation`. A `409 edit_base_stale` (the live product changed
 * since this revision was based on it) is terminal from the creator's side:
 * only an admin can rebase or supersede it, so this never offers a retry for
 * that case, unlike the ordinary 409 `version_conflict` (the edit's own
 * version moved, safe to reload and try again) or a transient failure.
 */
export function EditSubmitPanel({ coordinator, disabled, onSubmitted }: EditSubmitPanelProps) {
  const theme = useTheme();
  const submitEdit = useSubmitEdit();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErrorMessage(null);
    setStale(false);
    try {
      const flushed = await coordinator.flushMetadata();
      if (coordinator.hasConflict()) {
        idempotencyKeyRef.current = null;
        setErrorMessage('This revision changed elsewhere. Resolve the conflict above before submitting.');
        return;
      }
      const key = idempotencyKeyRef.current ?? newIdempotencyKey();
      idempotencyKeyRef.current = key;
      const submitted = await submitEdit.mutateAsync({ id: flushed.id, version: flushed.version, idempotencyKey: key });
      idempotencyKeyRef.current = null;
      onSubmitted(submitted);
    } catch (err) {
      idempotencyKeyRef.current = null;
      if (isApiError(err) && err.code === 'edit_base_stale') {
        setStale(true);
        setErrorMessage('The product changed since this revision was based on it. An admin needs to resolve this before you can resubmit.');
        return;
      }
      setErrorMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {errorMessage ? (
        <Text testID="edit-submit-error" style={{ color: theme.colors.danger }}>
          {errorMessage}
        </Text>
      ) : null}
      {!stale ? (
        <Button
          testID="edit-submit"
          label={busy ? 'Submitting…' : 'Submit Changes'}
          loading={busy}
          disabled={busy || disabled}
          onPress={submit}
        />
      ) : null}
    </View>
  );
}
