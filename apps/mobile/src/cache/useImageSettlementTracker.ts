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

  useEffect(() => {
    activeKeyRef.current = urisKey;

    if (validUris.length === 0) {
      setSettledUris(new Set());
      setTimedOut(false);
      return;
    }

    // Reset settlement state for new non-empty URI set
    setSettledUris(new Set());
    setTimedOut(false);

    // Deterministic safety fail-safe timeout
    const timer = setTimeout(() => {
      setTimedOut(true);
    }, timeoutMs);

    return () => {
      clearTimeout(timer);
    };
  }, [urisKey, validUris.length, timeoutMs]);

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
      if (timedOut) return true;
      return settledUris.has(uri);
    },
    [validUris.length, settledUris, timedOut]
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
