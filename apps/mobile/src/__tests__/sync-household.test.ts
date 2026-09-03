// apps/mobile/src/__tests__/sync-household.test.ts
// Unit-level tests for the sync split-conflict-policy decision logic.
// Extracted as pure functions so they can be tested without a live WatermelonDB.

/**
 * Pure predicate: should the incoming server change overwrite the local row?
 * Extracted from sync.ts for testability.
 */
function shouldServerWin(serverHouseholdId: string | null, localPendingSync: boolean): boolean {
  // Household records: server always wins (unconditional overwrite).
  if (serverHouseholdId) return true;
  // Personal records: LWW — skip if local has a newer pending edit.
  return !localPendingSync;
}

/**
 * Pure predicate: is this change a scope-change conflict?
 * True when the client BELIEVES the record is in one scope (null or a household id)
 * but the server's scope differs.
 */
function isScopeChange(clientBelievedHouseholdId: string | null, serverHouseholdId: string | null): boolean {
  return clientBelievedHouseholdId !== serverHouseholdId;
}

/**
 * Pure: should a local record be purged?
 */
function shouldPurge(localHouseholdId: string | null, lostHouseholdIds: Set<string>): boolean {
  return localHouseholdId !== null && lostHouseholdIds.has(localHouseholdId);
}

/**
 * Pure: should a local household record be purged given the authoritative accessible household IDs?
 */
function shouldPurgeRevoked(localHouseholdId: string | null, accessibleHouseholdIds: Set<string>): boolean {
  if (localHouseholdId === null) return false;
  return !accessibleHouseholdIds.has(localHouseholdId);
}

/**
 * Pure: should a push failure destroy the local record to prevent wedging sync?
 */
function shouldRecoverFromPushError(status: number, isHouseholdRecord: boolean): boolean {
  return isHouseholdRecord && (status === 403 || status === 404);
}

describe('sync split conflict policy — pure logic', () => {
  describe('shouldServerWin', () => {
    it('household record always server-wins even when local has newer pending edit', () => {
      expect(shouldServerWin('hh-1', true)).toBe(true);
      expect(shouldServerWin('hh-1', false)).toBe(true);
    });

    it('personal record server-wins only when no local pending edit', () => {
      expect(shouldServerWin(null, true)).toBe(false);
      expect(shouldServerWin(null, false)).toBe(true);
    });
  });

  describe('isScopeChange', () => {
    it('personal → household is a scope change', () => {
      expect(isScopeChange(null, 'hh-1')).toBe(true);
    });

    it('household → personal is a scope change', () => {
      expect(isScopeChange('hh-1', null)).toBe(true);
    });

    it('same scope is not a change', () => {
      expect(isScopeChange(null, null)).toBe(false);
      expect(isScopeChange('hh-1', 'hh-1')).toBe(false);
    });
  });

  describe('shouldPurge', () => {
    it('purges records belonging to a lost household', () => {
      expect(shouldPurge('hh-1', new Set(['hh-1', 'hh-2']))).toBe(true);
    });

    it('keeps personal records', () => {
      expect(shouldPurge(null, new Set(['hh-1']))).toBe(false);
    });

    it('keeps records of still-joined households', () => {
      expect(shouldPurge('hh-3', new Set(['hh-1', 'hh-2']))).toBe(false);
    });
  });

  describe('shouldPurgeRevoked', () => {
    it('purges records whose household is not in the authoritative accessible set', () => {
      const accessible = new Set(['hh-1', 'hh-2']);
      expect(shouldPurgeRevoked('hh-revoked', accessible)).toBe(true);
    });

    it('retains records whose household is in the authoritative accessible set', () => {
      const accessible = new Set(['hh-1', 'hh-2']);
      expect(shouldPurgeRevoked('hh-1', accessible)).toBe(false);
    });

    it('never purges personal records even if accessible households is empty', () => {
      const accessible = new Set<string>();
      expect(shouldPurgeRevoked(null, accessible)).toBe(false);
    });
  });

  describe('shouldRecoverFromPushError', () => {
    it('destroys local row on 403 or 404 for household records to unwedge sync', () => {
      expect(shouldRecoverFromPushError(403, true)).toBe(true);
      expect(shouldRecoverFromPushError(404, true)).toBe(true);
    });

    it('does not destroy on transient 500 errors', () => {
      expect(shouldRecoverFromPushError(500, true)).toBe(false);
    });

    it('does not destroy personal records on 403', () => {
      expect(shouldRecoverFromPushError(403, false)).toBe(false);
    });
  });
});
