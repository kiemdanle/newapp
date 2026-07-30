import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { Product } from '@expyrico/shared';
import { useSubmitDraft } from '../../api/products';
import { isApiError } from '../../api/errors';
import { executeProductSubmitAssessment } from '../../security/product-creation-assessment';
import { newIdempotencyKey } from '../../lib/idempotency';
import type { DraftMutationCoordinator } from './draft-mutation-coordinator';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';

export interface DraftSubmitPanelProps {
  coordinator: DraftMutationCoordinator<Product>;
  /** True while the draft has unsaved metadata text or an in-flight photo
   * upload — submit is disabled until the caller clears this. */
  disabled?: boolean;
  onSubmitted: (product: Product) => void;
}

/**
 * Flushes any pending metadata, mints a fresh `submit_product` reCAPTCHA
 * token, and submits the draft for moderation. A `temporarily_unavailable`
 * (503) response is the one retryable outcome that reuses the same
 * Idempotency-Key — the server's idempotency plugin only releases its
 * reservation on a 5xx, so replaying the same key there is safe and the
 * plugin would otherwise treat a same-key/different-body retry (a fresh
 * token every attempt, per the binding submit-retry contract) as
 * `idempotency_key_reused`. Every other outcome (success, abuse rejection,
 * validation, version conflict) mints a fresh key for any further attempt.
 */
export function DraftSubmitPanel({ coordinator, disabled, onSubmitted }: DraftSubmitPanelProps) {
  const theme = useTheme();
  const submitDraft = useSubmitDraft();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErrorMessage(null);
    try {
      const flushed = await coordinator.flushMetadata();
      if (coordinator.hasConflict()) {
        idempotencyKeyRef.current = null;
        setErrorMessage('This draft changed elsewhere. Resolve the conflict above before submitting.');
        setRetryable(false);
        return;
      }
      const { token, platform } = await executeProductSubmitAssessment();
      const key = idempotencyKeyRef.current ?? newIdempotencyKey();
      idempotencyKeyRef.current = key;
      const submitted = await submitDraft.mutateAsync({
        id: flushed.id,
        version: flushed.version,
        abuseToken: token,
        platform,
        idempotencyKey: key,
      });
      idempotencyKeyRef.current = null;
      onSubmitted(submitted);
    } catch (err) {
      if (isApiError(err) && err.status === 503 && err.code === 'temporarily_unavailable') {
        // Keep the same key — the next attempt reuses it with a fresh token.
        setErrorMessage('Submission service is temporarily unavailable. Try again in a moment.');
        setRetryable(true);
        return;
      }
      idempotencyKeyRef.current = null;
      setRetryable(false);
      if (isApiError(err) && err.code === 'abuse_check_failed') {
        setErrorMessage("We couldn't verify this submission. Your draft is unchanged — you can try again.");
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
        <Text testID="draft-submit-error" style={{ color: theme.colors.danger }}>
          {errorMessage}
        </Text>
      ) : null}
      <Button
        testID="draft-submit"
        label={busy ? 'Submitting…' : retryable ? 'Retry submit' : 'Submit for review'}
        loading={busy}
        disabled={busy || disabled}
        onPress={submit}
      />
    </View>
  );
}
