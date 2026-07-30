import { describe, expect, it, vi, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';

const { lookupOffMock, lookupUpcitemdbMock } = vi.hoisted(() => ({
  lookupOffMock: vi.fn(),
  lookupUpcitemdbMock: vi.fn(),
}));

vi.mock('./off-client.js', () => ({ lookupOff: lookupOffMock }));
vi.mock('./upcitemdb-client.js', () => ({ lookupUpcitemdb: lookupUpcitemdbMock }));

import { lookupProduct, lookupProductV2, persistExternal } from './lookup.js';
import { getPrisma } from '../../db.js';
import { makeUser, makeProduct } from '../../../tests/helpers/factories.js';

const FOUND = (overrides: Partial<{ name: string; brand: string | null }> = {}) => ({
  status: 'found' as const,
  data: {
    barcode: '5000000000000',
    name: overrides.name ?? 'External Product',
    brand: overrides.brand ?? null,
    category: null,
    imageUrl: null,
    source: 'off' as const,
    sourceId: '5000000000000',
  },
});
const NOT_FOUND = { status: 'not_found' as const };
const UNAVAILABLE = { status: 'unavailable' as const };

describe('lookupProduct (legacy)', () => {
  beforeEach(() => {
    lookupOffMock.mockReset();
    lookupUpcitemdbMock.mockReset();
  });

  it('returns the active local row without calling external providers', async () => {
    const p = await makeProduct({ barcode: '5449000000996', name: 'Coke' });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'active' } });
    const result = await lookupProduct({ barcode: '5449000000996' });
    expect(result.product?.name).toBe('Coke');
    expect(result.privateReservation).toBe(false);
    expect(lookupOffMock).not.toHaveBeenCalled();
    expect(lookupUpcitemdbMock).not.toHaveBeenCalled();
  });

  it.each(['draft', 'pending', 'changes_required', 'report_hidden', 'merged_into'] as const)(
    'short-circuits a local %s row: null product, privateReservation true, no external calls',
    async (status) => {
      const creator = await makeUser();
      const p = await makeProduct({ barcode: '1111111111111', createdByUserId: creator.id });
      await getPrisma().product.update({ where: { id: p.id }, data: { status } });
      const result = await lookupProduct({ barcode: '1111111111111' });
      expect(result.product).toBeNull();
      expect(result.privateReservation).toBe(true);
      expect(lookupOffMock).not.toHaveBeenCalled();
      expect(lookupUpcitemdbMock).not.toHaveBeenCalled();
    },
  );

  it('falls through to upcitemdb when off is a conclusive miss', async () => {
    lookupOffMock.mockResolvedValue(NOT_FOUND);
    lookupUpcitemdbMock.mockResolvedValue(FOUND());
    const result = await lookupProduct({ barcode: '5000000000000' });
    expect(result.product?.name).toBe('External Product');
  });

  it('falls through to upcitemdb when off is unavailable (preserves legacy resilience)', async () => {
    lookupOffMock.mockResolvedValue(UNAVAILABLE);
    lookupUpcitemdbMock.mockResolvedValue(FOUND());
    const result = await lookupProduct({ barcode: '5000000000000' });
    expect(result.product?.name).toBe('External Product');
  });

  it('is a plain miss when both sources conclusively miss', async () => {
    lookupOffMock.mockResolvedValue(NOT_FOUND);
    lookupUpcitemdbMock.mockResolvedValue(NOT_FOUND);
    const result = await lookupProduct({ barcode: '5000000000000' });
    expect(result.product).toBeNull();
    expect(result.privateReservation).toBe(false);
  });

  it('never calls external providers for a qr-only local miss', async () => {
    const result = await lookupProduct({ qr: 'qr-payload-xyz' });
    expect(result.product).toBeNull();
    expect(lookupOffMock).not.toHaveBeenCalled();
    expect(lookupUpcitemdbMock).not.toHaveBeenCalled();
  });

  it('a private draft created during the external round trip is a plain 404, never serialized', async () => {
    const barcode = '9990000000011';
    const other = await makeUser();
    lookupOffMock.mockImplementation(async () => {
      await getPrisma().product.create({
        data: { barcode, name: 'Race Draft 2', source: 'user', createdByUserId: other.id, status: 'draft' },
      });
      return { status: 'found', data: { barcode, name: 'External Name', brand: null, category: null, imageUrl: null, source: 'off' as const, sourceId: barcode } };
    });
    const result = await lookupProduct({ barcode });
    expect(result.product).toBeNull();
    expect(result.privateReservation).toBe(true);
  });

  it('merged_into resolves to the active canonical row, serialized as the canonical product', async () => {
    const canonical = await makeProduct({ barcode: '9990000000025', name: 'Canonical Legacy' });
    const loser = await makeProduct({ barcode: '9990000000026' });
    await getPrisma().product.update({
      where: { id: loser.id },
      data: { status: 'merged_into', mergedIntoProductId: canonical.id },
    });
    const result = await lookupProduct({ barcode: '9990000000026' });
    expect(result.product?.id).toBe(canonical.id);
    expect(result.privateReservation).toBe(false);
  });
});

describe('lookupProductV2', () => {
  beforeEach(() => {
    lookupOffMock.mockReset();
    lookupUpcitemdbMock.mockReset();
  });

  it('active local row -> found for any actor', async () => {
    const p = await makeProduct({ barcode: '2222222222222' });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'active' } });
    const actor = await makeUser();
    const res = await lookupProductV2({ barcode: '2222222222222' }, { id: actor.id, role: 'user' });
    expect(res).toMatchObject({ outcome: 'found' });
  });

  it('creator draft -> editable_private for the creator', async () => {
    const creator = await makeUser();
    const p = await makeProduct({ barcode: '3333333333333', createdByUserId: creator.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await lookupProductV2({ barcode: '3333333333333' }, { id: creator.id, role: 'user' });
    expect(res.outcome).toBe('editable_private');
  });

  it('creator changes_required -> editable_private for the creator', async () => {
    const creator = await makeUser();
    const p = await makeProduct({ barcode: '3333333333334', createdByUserId: creator.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'changes_required' } });
    const res = await lookupProductV2({ barcode: '3333333333334' }, { id: creator.id, role: 'user' });
    expect(res.outcome).toBe('editable_private');
  });

  it('creator pending -> creator_pending, read-only', async () => {
    const creator = await makeUser();
    const p = await makeProduct({ barcode: '4444444444444', createdByUserId: creator.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'pending' } });
    const res = await lookupProductV2({ barcode: '4444444444444' }, { id: creator.id, role: 'user' });
    expect(res.outcome).toBe('creator_pending');
    if (res.outcome === 'creator_pending') {
      expect(res.product.id).toBe(p.id);
    }
  });

  it('another user against a creator draft/pending -> under_review, no metadata', async () => {
    const creator = await makeUser();
    const other = await makeUser();
    const p = await makeProduct({ barcode: '5555555555555', createdByUserId: creator.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await lookupProductV2({ barcode: '5555555555555' }, { id: other.id, role: 'user' });
    expect(res).toEqual({ outcome: 'under_review' });
  });

  it('report_hidden -> under_review for an ordinary user even when a creator is set', async () => {
    const creator = await makeUser();
    const p = await makeProduct({ barcode: '6666666666666', createdByUserId: creator.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'report_hidden' } });
    const res = await lookupProductV2({ barcode: '6666666666666' }, { id: creator.id, role: 'user' });
    expect(res).toEqual({ outcome: 'under_review' });
  });

  it('admin sees a non-active row as a read-only authorized result, never editable_private', async () => {
    const creator = await makeUser();
    const admin = await makeUser({ role: 'admin' });
    const p = await makeProduct({ barcode: '7777777777777', createdByUserId: creator.id });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'draft' } });
    const res = await lookupProductV2({ barcode: '7777777777777' }, { id: admin.id, role: 'admin' });
    expect(res.outcome).toBe('creator_pending');
  });

  it('admin sees report_hidden as an authorized result too (not under_review)', async () => {
    const admin = await makeUser({ role: 'admin' });
    const p = await makeProduct({ barcode: '7777777777778' });
    await getPrisma().product.update({ where: { id: p.id }, data: { status: 'report_hidden' } });
    const res = await lookupProductV2({ barcode: '7777777777778' }, { id: admin.id, role: 'admin' });
    expect(res.outcome).toBe('creator_pending');
  });

  it('qr-only local miss is conclusive: not_found, canCreate false, no external calls', async () => {
    const actor = await makeUser();
    const res = await lookupProductV2({ qr: 'no-such-qr' }, { id: actor.id, role: 'user' });
    expect(res).toEqual({ outcome: 'not_found', canCreate: false });
    expect(lookupOffMock).not.toHaveBeenCalled();
    expect(lookupUpcitemdbMock).not.toHaveBeenCalled();
  });

  it('off unavailable then upcitemdb found -> found (unavailability never poisons a hit)', async () => {
    lookupOffMock.mockResolvedValue(UNAVAILABLE);
    lookupUpcitemdbMock.mockResolvedValue(FOUND());
    const actor = await makeUser();
    const res = await lookupProductV2({ barcode: '5000000000000' }, { id: actor.id, role: 'user' });
    expect(res.outcome).toBe('found');
  });

  it('off not_found then upcitemdb unavailable -> temporarily_unavailable', async () => {
    lookupOffMock.mockResolvedValue(NOT_FOUND);
    lookupUpcitemdbMock.mockResolvedValue(UNAVAILABLE);
    const actor = await makeUser();
    const res = await lookupProductV2({ barcode: '5000000000001' }, { id: actor.id, role: 'user' });
    expect(res).toEqual({ outcome: 'temporarily_unavailable' });
  });

  it('both sources conclusively miss -> not_found, canCreate false', async () => {
    lookupOffMock.mockResolvedValue(NOT_FOUND);
    lookupUpcitemdbMock.mockResolvedValue(NOT_FOUND);
    const actor = await makeUser();
    const res = await lookupProductV2({ barcode: '5000000000002' }, { id: actor.id, role: 'user' });
    expect(res).toEqual({ outcome: 'not_found', canCreate: false });
  });

  it('a private draft created during the external round trip is never exposed as found', async () => {
    const barcode = '9990000000010';
    const other = await makeUser();
    lookupOffMock.mockImplementation(async () => {
      // Simulates another user's draft winning the create race while this
      // request's OFF HTTP call is in flight.
      await getPrisma().product.create({
        data: { barcode, name: 'Race Draft', source: 'user', createdByUserId: other.id, status: 'draft' },
      });
      return { status: 'found', data: { barcode, name: 'External Name', brand: null, category: null, imageUrl: null, source: 'off' as const, sourceId: barcode } };
    });
    const actor = await makeUser();
    const res = await lookupProductV2({ barcode }, { id: actor.id, role: 'user' });
    expect(res).toEqual({ outcome: 'under_review' });
  });

  it('merged_into resolves to the active canonical product -> found', async () => {
    const canonical = await makeProduct({ barcode: '9990000000020', name: 'Canonical' });
    const loser = await makeProduct({ barcode: '9990000000021' });
    await getPrisma().product.update({
      where: { id: loser.id },
      data: { status: 'merged_into', mergedIntoProductId: canonical.id },
    });
    const actor = await makeUser();
    const res = await lookupProductV2({ barcode: '9990000000021' }, { id: actor.id, role: 'user' });
    expect(res.outcome).toBe('found');
    if (res.outcome === 'found') expect(res.product.id).toBe(canonical.id);
  });

  it('merged_into resolves to a non-active canonical and classifies it normally', async () => {
    const creator = await makeUser();
    const canonicalDraft = await makeProduct({ barcode: '9990000000022', createdByUserId: creator.id });
    await getPrisma().product.update({ where: { id: canonicalDraft.id }, data: { status: 'draft' } });
    const loser = await makeProduct({ barcode: '9990000000023' });
    await getPrisma().product.update({
      where: { id: loser.id },
      data: { status: 'merged_into', mergedIntoProductId: canonicalDraft.id },
    });
    const res = await lookupProductV2({ barcode: '9990000000023' }, { id: creator.id, role: 'user' });
    expect(res.outcome).toBe('editable_private');
  });

  it('a cyclical merge chain is depth-capped to a non-disclosing dead end, even for admin', async () => {
    // FK-enforced pointers rule out a truly dangling reference, but a cycle
    // (A -> B -> A) is representable and would loop forever without the depth
    // cap — this proves the cap actually terminates it.
    const a = await makeProduct({ barcode: '9990000000024' });
    const b = await makeProduct({ barcode: '9990000000027' });
    await getPrisma().product.update({ where: { id: a.id }, data: { mergedIntoProductId: b.id } });
    await getPrisma().product.update({ where: { id: b.id }, data: { mergedIntoProductId: a.id } });
    await getPrisma().product.update({ where: { id: a.id }, data: { status: 'merged_into' } });
    await getPrisma().product.update({ where: { id: b.id }, data: { status: 'merged_into' } });
    const admin = await makeUser({ role: 'admin' });
    const res = await lookupProductV2({ barcode: '9990000000024' }, { id: admin.id, role: 'admin' });
    expect(res).toEqual({ outcome: 'under_review' });
  });
});

describe('persistExternal race safety', () => {
  it('never overwrites an existing active user-sourced row for the same barcode', async () => {
    const creator = await makeUser();
    const userProduct = await makeProduct({
      barcode: '8888888888888',
      name: 'My Homemade Jam',
      source: 'user',
      createdByUserId: creator.id,
    });
    await getPrisma().product.update({ where: { id: userProduct.id }, data: { status: 'active' } });
    const result = await persistExternal({
      barcode: '8888888888888',
      name: 'Some External Name',
      brand: null,
      category: null,
      imageUrl: null,
      source: 'off',
      sourceId: '8888888888888',
    });
    expect(result.id).toBe(userProduct.id);
    expect(result.name).toBe('My Homemade Jam');
    expect(result.source).toBe('user');
  });

  it('never overwrites an existing non-active (private) row for the same barcode', async () => {
    const creator = await makeUser();
    const draft = await makeProduct({
      barcode: '8888888888889',
      name: 'Unsubmitted Draft',
      createdByUserId: creator.id,
    });
    await getPrisma().product.update({ where: { id: draft.id }, data: { status: 'draft' } });
    const result = await persistExternal({
      barcode: '8888888888889',
      name: 'Some External Name',
      brand: null,
      category: null,
      imageUrl: null,
      source: 'off',
      sourceId: '8888888888889',
    });
    expect(result.id).toBe(draft.id);
    expect(result.name).toBe('Unsubmitted Draft');
    expect(result.status).toBe('draft');
  });

  it('refreshes an existing active external row for the same barcode', async () => {
    const existing = await makeProduct({ barcode: '8888888888890', name: 'Old Name', source: 'off' });
    await getPrisma().product.update({ where: { id: existing.id }, data: { status: 'active' } });
    const result = await persistExternal({
      barcode: '8888888888890',
      name: 'New Name',
      brand: 'New Brand',
      category: null,
      imageUrl: null,
      source: 'off',
      sourceId: '8888888888890',
    });
    expect(result.id).toBe(existing.id);
    expect(result.name).toBe('New Name');
  });

  it('creates a new row when no local row exists for the barcode', async () => {
    const result = await persistExternal({
      barcode: '8888888888891',
      name: 'Brand New',
      brand: null,
      category: null,
      imageUrl: null,
      source: 'upcitemdb',
      sourceId: '8888888888891',
    });
    expect(result.name).toBe('Brand New');
    expect(result.source).toBe('upcitemdb');
  });

  it('concurrent creates for the same new barcode never produce two rows', async () => {
    const data = {
      barcode: '8888888888892',
      name: 'Racer',
      brand: null,
      category: null,
      imageUrl: null,
      source: 'off' as const,
      sourceId: '8888888888892',
    };
    const [a, b] = await Promise.all([persistExternal(data), persistExternal(data)]);
    expect(a.id).toBe(b.id);
    const count = await getPrisma().product.count({ where: { barcode: '8888888888892' } });
    expect(count).toBe(1);
  });
});
