import { describe, it, expect } from 'vitest';
import {
  recordSchema,
  recordCreateSchema,
  recordPatchSchema,
  recordSyncConflictSchema,
  recordSyncBatchSchema,
  recordSyncResponseSchema,
} from './record';

describe('recordSchema location validation', () => {
  const baseRecord = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    clientId: '123e4567-e89b-12d3-a456-426614174001',
    userId: '123e4567-e89b-12d3-a456-426614174002',
    productId: null,
    householdId: null,
    customName: 'Milk',
    expiryDate: '2026-09-15',
    purchaseDate: null,
    quantity: 1,
    unit: 'bottle',
    notes: null,
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    consumedAt: null,
  };

  it('validates record with location string', () => {
    const parsed = recordSchema.parse({
      ...baseRecord,
      location: 'Fridge',
    });
    expect(parsed.location).toBe('Fridge');
  });

  it('validates record with null location', () => {
    const parsed = recordSchema.parse({
      ...baseRecord,
      location: null,
    });
    expect(parsed.location).toBeNull();
  });

  it('validates record with omitted location', () => {
    const parsed = recordSchema.parse(baseRecord);
    expect(parsed.location).toBeUndefined();
  });
});

describe('recordCreateSchema and recordPatchSchema location validation', () => {
  const baseCreate = {
    clientId: '123e4567-e89b-12d3-a456-426614174001',
    customName: 'Yogurt',
    expiryDate: '2026-09-20',
  };

  it('trims and accepts valid location', () => {
    const parsed = recordCreateSchema.parse({
      ...baseCreate,
      location: '  Freezer  ',
    });
    expect(parsed.location).toBe('Freezer');
  });

  it('transforms empty or whitespace location to null', () => {
    const parsed = recordCreateSchema.parse({
      ...baseCreate,
      location: '   ',
    });
    expect(parsed.location).toBeNull();
  });

  it('rejects location exceeding 50 characters', () => {
    expect(() =>
      recordCreateSchema.parse({
        ...baseCreate,
        location: 'A'.repeat(51),
      })
    ).toThrow();
  });

  it('rejects unprintable / control characters', () => {
    expect(() =>
      recordCreateSchema.parse({
        ...baseCreate,
        location: 'Fridge\u200B',
      })
    ).toThrow();
  });

  it('parses recordPatchSchema with location', () => {
    const parsed = recordPatchSchema.parse({
      location: 'Counter',
    });
    expect(parsed.location).toBe('Counter');
  });

  it('parses recordPatchSchema with null location', () => {
    const parsed = recordPatchSchema.parse({
      location: null,
    });
    expect(parsed.location).toBeNull();
  });
});

describe('recordCreateSchema and recordPatchSchema brand validation', () => {
  const baseCreate = {
    clientId: '123e4567-e89b-12d3-a456-426614174001',
    customName: 'Milk',
    expiryDate: '2099-12-31',
  };

  it('parses recordCreateSchema with trimmed brand', () => {
    const parsed = recordCreateSchema.parse({
      ...baseCreate,
      brand: '  TH True Milk  ',
    });
    expect(parsed.brand).toBe('TH True Milk');
  });

  it('parses recordCreateSchema with null brand', () => {
    const parsed = recordCreateSchema.parse({
      ...baseCreate,
      brand: null,
    });
    expect(parsed.brand).toBeNull();
  });

  it('parses recordPatchSchema with brand', () => {
    const parsed = recordPatchSchema.parse({
      brand: 'Vinamilk',
    });
    expect(parsed.brand).toBe('Vinamilk');
  });

  it('parses recordPatchSchema with null brand', () => {
    const parsed = recordPatchSchema.parse({
      brand: null,
    });
    expect(parsed.brand).toBeNull();
  });

  it('rejects brand exceeding 120 characters', () => {
    expect(() =>
      recordPatchSchema.parse({
        brand: 'a'.repeat(121),
      })
    ).toThrow();
  });
});

describe('recordCreateSchema terminal fields & sync schemas', () => {
  const baseCreate = {
    clientId: '123e4567-e89b-12d3-a456-426614174001',
    customName: 'Yogurt',
    expiryDate: '2026-09-20',
  };

  it('accepts optional status and terminal history fields in recordCreateSchema', () => {
    const parsed = recordCreateSchema.parse({
      ...baseCreate,
      status: 'consumed',
      consumedAt: '2026-09-12T10:00:00.000Z',
    });
    expect(parsed.status).toBe('consumed');
    expect(parsed.consumedAt).toBe('2026-09-12T10:00:00.000Z');

    const discarded = recordCreateSchema.parse({
      ...baseCreate,
      status: 'discarded',
      discardedAt: '2026-09-12T10:00:00.000Z',
      discardReason: 'spoiled',
    });
    expect(discarded.status).toBe('discarded');
    expect(discarded.discardReason).toBe('spoiled');
  });

  it('validates recordSyncConflictSchema with item_limit_reached', () => {
    const conflict = recordSyncConflictSchema.parse({
      clientId: '123e4567-e89b-12d3-a456-426614174001',
      reason: 'item_limit_reached',
    });
    expect(conflict.reason).toBe('item_limit_reached');

    expect(() =>
      recordSyncConflictSchema.parse({
        clientId: '123e4567-e89b-12d3-a456-426614174001',
        reason: 'invalid_reason',
      })
    ).toThrow();
  });

  it('parses recordSyncBatchSchema with and without composite cursor', () => {
    const withoutCursor = recordSyncBatchSchema.parse({
      upserts: [],
      deletes: [],
    });
    expect(withoutCursor.cursor).toBeUndefined();

    const withCursor = recordSyncBatchSchema.parse({
      cursor: {
        updatedAt: '2026-09-12T10:00:00.000Z',
        id: '123e4567-e89b-12d3-a456-426614174001',
      },
      upserts: [],
      deletes: [],
    });
    expect(withCursor.cursor).toEqual({
      updatedAt: '2026-09-12T10:00:00.000Z',
      id: '123e4567-e89b-12d3-a456-426614174001',
    });
  });

  it('parses recordSyncResponseSchema with nextCursor and hasMore', () => {
    const parsed = recordSyncResponseSchema.parse({
      serverTime: '2026-09-12T12:00:00.000Z',
      changes: [],
      deletedIds: [],
      conflicts: [],
      householdIds: [],
      nextCursor: {
        updatedAt: '2026-09-12T10:00:00.000Z',
        id: '123e4567-e89b-12d3-a456-426614174001',
      },
      hasMore: true,
    });
    expect(parsed.hasMore).toBe(true);
    expect(parsed.nextCursor).toEqual({
      updatedAt: '2026-09-12T10:00:00.000Z',
      id: '123e4567-e89b-12d3-a456-426614174001',
    });

    const defaults = recordSyncResponseSchema.parse({
      serverTime: '2026-09-12T12:00:00.000Z',
      changes: [],
      deletedIds: [],
    });
    expect(defaults.hasMore).toBe(false);
    expect(defaults.nextCursor).toBeUndefined();
  });
});
