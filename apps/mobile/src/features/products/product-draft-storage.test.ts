import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveDraftLocalState,
  getDraftLocalState,
  removeDraftLocalState,
  clearDraftLocalStateForUser,
} from './product-draft-storage';

describe('product-draft-storage', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves and reads back local state keyed by user + identifier', async () => {
    await saveDraftLocalState('user-a', {
      productId: 'draft-1',
      identifier: { barcode: '123' },
      dirty: { name: 'Frozen peas (unsaved)' },
      updatedAt: '2026-01-01T00:00:00Z',
    });

    const state = await getDraftLocalState('user-a', { barcode: '123' });
    expect(state).toMatchObject({ productId: 'draft-1', dirty: { name: 'Frozen peas (unsaved)' } });
  });

  it('returns null when nothing is stored for that identifier', async () => {
    const state = await getDraftLocalState('user-a', { barcode: 'never-saved' });
    expect(state).toBeNull();
  });

  it('keeps qr and barcode identifiers distinct even with the same value', async () => {
    await saveDraftLocalState('user-a', {
      productId: 'draft-barcode',
      identifier: { barcode: 'x1' },
      updatedAt: '2026-01-01T00:00:00Z',
    });
    await saveDraftLocalState('user-a', {
      productId: 'draft-qr',
      identifier: { qr: 'x1' },
      updatedAt: '2026-01-01T00:00:00Z',
    });

    expect((await getDraftLocalState('user-a', { barcode: 'x1' }))?.productId).toBe('draft-barcode');
    expect((await getDraftLocalState('user-a', { qr: 'x1' }))?.productId).toBe('draft-qr');
  });

  it('isolates entries per user — the same identifier under a different user resolves to nothing', async () => {
    await saveDraftLocalState('user-a', {
      productId: 'draft-1',
      identifier: { barcode: '123' },
      updatedAt: '2026-01-01T00:00:00Z',
    });

    const state = await getDraftLocalState('user-b', { barcode: '123' });
    expect(state).toBeNull();
  });

  it('explicit removal clears exactly one entry, leaving other identifiers intact', async () => {
    await saveDraftLocalState('user-a', { productId: 'd1', identifier: { barcode: '1' }, updatedAt: '2026-01-01T00:00:00Z' });
    await saveDraftLocalState('user-a', { productId: 'd2', identifier: { barcode: '2' }, updatedAt: '2026-01-01T00:00:00Z' });

    await removeDraftLocalState('user-a', { barcode: '1' });

    expect(await getDraftLocalState('user-a', { barcode: '1' })).toBeNull();
    expect((await getDraftLocalState('user-a', { barcode: '2' }))?.productId).toBe('d2');
  });

  it('clearing one user does not touch another user\'s stored drafts', async () => {
    await saveDraftLocalState('user-a', { productId: 'da', identifier: { barcode: '1' }, updatedAt: '2026-01-01T00:00:00Z' });
    await saveDraftLocalState('user-b', { productId: 'db', identifier: { barcode: '1' }, updatedAt: '2026-01-01T00:00:00Z' });

    await clearDraftLocalStateForUser('user-a');

    expect(await getDraftLocalState('user-a', { barcode: '1' })).toBeNull();
    expect((await getDraftLocalState('user-b', { barcode: '1' }))?.productId).toBe('db');
  });

  it('treats a corrupted stored index as empty rather than throwing', async () => {
    await AsyncStorage.setItem('pantry.productDraftIndex.v1.user-a', 'not-json{{{');
    const state = await getDraftLocalState('user-a', { barcode: '1' });
    expect(state).toBeNull();
  });
});
