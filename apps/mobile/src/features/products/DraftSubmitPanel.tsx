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
 * token, and submits the draft for moderation. Any 5xx response, and any
 * transport-level failure that never got a response at all, reuses the same
 * Idempotency-Key — the server's idempotency plugin only releases its
 * reservation on a 5xx (never on a genuine non-response, which by
 * definition can't have cached anything under that key either), so
 * replaying the same key there is safe, and the plugin would otherwise
 * treat a same-key/different-body retry (a fresh token every attempt, per
 * the binding submit-retry contract) as `idempotency_key_reused`. Every
 * other, *definitive* non-5xx outcome (success, abuse rejection, validation,
 * version conflict) mints a fresh key for any further attempt, since the
 * plugin cached that exact key+body pair.
 */
export function DraftSubmitPanel({ coordinator, disabled, onSubmitted }: DraftSubmitPanelProps) {
  const theme = useTheme();
  const submitDraft = useSubmitDraft();
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  // L2: `busy` alone doesn't reach `Button`'s own `disabled` prop until
  // after a re-render — a double-tap inside one synchronous batch would
  // otherwise queue two submits sharing one idempotency key with two
  // different abuse tokens (the second gets a confusing
  // `idempotency_in_progress`, not a duplicate submission, but still a
  // needless race). Mirrors scan.tsx's own ref-based in-flight guard.
  const submitInFlightRef = useRef(false);

  const submit = async () => {
    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
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
      // Any 5xx, or a transport-level failure that isn't even an
      // `ApiError` (fetch threw before a response arrived — e.g. the
      // request never reached the server, or reCAPTCHA itself failed before
      // any HTTP call was made), keeps the same key. Only a definitive
      // non-5xx response — one the idempotency plugin actually cached —
      // needs a fresh key on the next attempt.
      const keepsKey = !isApiError(err) || err.status >= 500;
      if (keepsKey) {
        setErrorMessage(
          isApiError(err) && err.status === 503 && err.code === 'temporarily_unavailable'
            ? 'Submission service is temporarily unavailable. Try again in a moment.'
            : ((err as Error).message || 'Something went wrong. Try again.'),
        );
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
      submitInFlightRef.current = false;
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
        label={busy ? 'Posting Product…' : retryable ? 'Retry submit' : 'Post New Product'}
        loading={busy}
        disabled={busy || disabled}
        onPress={submit}
      />
    </View>
  );
}
