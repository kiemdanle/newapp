import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface UseImageSettlementTrackerResult {
  allSettled: boolean;
  markSettled: (uri: string) => void;
  isSettled: (uri: string) => boolean;
}
export interface UseImageSettlementTrackerOptions {
  timeoutMs?: number;
}

export function useImageSettlementTracker(
  uris: string[],
  options?: UseImageSettlementTrackerOptions,
): UseImageSettlementTrackerResult {
  const timeoutMs = options?.timeoutMs ?? 3000;
  const validUris = useMemo(() => uris.filter((u): u is string => Boolean(u && typeof u === 'string')), [uris]);
  const urisKey = validUris.join('|');

  const [settledUris, setSettledUris] = useState<Set<string>>(() => new Set());
  const [timedOut, setTimedOut] = useState(false);
  const activeKeyRef = useRef(urisKey);
  const timerRef = useRef<NodeJS.Timeout | number | null>(null);

  useEffect(() => {
    activeKeyRef.current = urisKey;

    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (validUris.length === 0) {
      setSettledUris(new Set());
      setTimedOut(false);
      return;
    }

    // Reset settlement state for new non-empty URI set
    setSettledUris(new Set());
    setTimedOut(false);

    // Deterministic safety fail-safe timeout
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setTimedOut(true);
    }, timeoutMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [urisKey, validUris.length, timeoutMs]);

  // Clear aggregate timer immediately once all valid URIs are settled
  useEffect(() => {
    if (validUris.length > 0 && validUris.every((u) => settledUris.has(u))) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [validUris, settledUris]);

  const markSettled = useCallback((uri: string) => {
    if (!uri) return;
    setSettledUris((prev) => {
      if (prev.has(uri)) return prev;
      const next = new Set(prev);
      next.add(uri);
      return next;
    });
  }, []);

  const isSettled = useCallback(
    (uri: string) => {
      if (!uri) return true;
      if (validUris.length === 0) return true;
      if (!validUris.includes(uri)) return true;
      if (timedOut) return true;
      return settledUris.has(uri);
    },
    [validUris, settledUris, timedOut]
  );
  const allSettled = useMemo(() => {
    if (validUris.length === 0) return true;
    if (timedOut) return true;
    return validUris.every((u) => settledUris.has(u));
  }, [validUris, settledUris, timedOut]);

  return {
    allSettled,
    markSettled,
    isSettled,
  };
}
