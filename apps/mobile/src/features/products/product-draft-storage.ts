import AsyncStorage from '@react-native-async-storage/async-storage';

// The server (GET /products/drafts, and lookup-v2 itself) is the source of
// truth for WHICH drafts exist and their saved state — this index exists
// only for state that isn't on the server yet: text a user is still typing
// (so a killed app can restore it) and which local draft a given scanned
// identifier maps to before a fresh lookup round-trip confirms it. One
// AsyncStorage key per user (never a single global key) so a purge is exact
// and no entry can ever resolve for the wrong account.
const STORAGE_PREFIX = 'pantry.productDraftIndex.v1';

export interface DraftIdentifier {
  barcode?: string | null;
  qr?: string | null;
}

export interface DraftLocalState {
  productId: string;
  identifier: DraftIdentifier;
  dirty?: {
    name?: string;
    description?: string | null;
    brand?: string | null;
    category?: string | null;
  };
  updatedAt: string;
}

type Index = Record<string, DraftLocalState>;

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}.${userId}`;
}

function identifierKey(identifier: DraftIdentifier): string {
  if (identifier.barcode) return `barcode:${identifier.barcode}`;
  if (identifier.qr) return `qr:${identifier.qr}`;
  throw new Error('a draft identifier requires exactly one of barcode | qr');
}

async function readIndex(userId: string): Promise<Index> {
  const raw = await AsyncStorage.getItem(storageKey(userId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Index;
  } catch {
    // A corrupted index must never crash the editor — treat as empty and let
    // the next save overwrite it.
    return {};
  }
}

async function writeIndex(userId: string, index: Index): Promise<void> {
  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(index));
}

/** Saves (or overwrites) the local-only state for one user+identifier pair. */
export async function saveDraftLocalState(userId: string, entry: DraftLocalState): Promise<void> {
  const index = await readIndex(userId);
  index[identifierKey(entry.identifier)] = entry;
  await writeIndex(userId, index);
}

/** Reads back the local-only state for one user+identifier pair, or `null`
 * if nothing is stored (the common case — most drafts have no unsaved local
 * state most of the time). */
export async function getDraftLocalState(userId: string, identifier: DraftIdentifier): Promise<DraftLocalState | null> {
  const index = await readIndex(userId);
  return index[identifierKey(identifier)] ?? null;
}

/** Explicit key removal — call after a successful save (nothing left dirty)
 * or an explicit discard, and whenever a stored entry turns out to point at
 * a draft the server no longer serves (404/410), so a stale local reference
 * never resurrects a deleted/inaccessible draft. */
export async function removeDraftLocalState(userId: string, identifier: DraftIdentifier): Promise<void> {
  const index = await readIndex(userId);
  delete index[identifierKey(identifier)];
  await writeIndex(userId, index);
}

/** Clears every locally-stored draft entry for one user. This is a data-
 * hygiene measure for shared devices (don't leave unsaved draft text sitting
 * in storage after sign-out) — unlike the private-image cache, entries here
 * are already namespaced per user ID and can never serve a different
 * account by accident even without this call, so it's wired into sign-out
 * only, not sign-in. */
export async function clearDraftLocalStateForUser(userId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(userId));
}
