import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  productEditPhotoSchema,
  productEditRowSchema,
  productEditMetadataPatchRequestSchema,
  productEditPhotoReorderRequestSchema,
  productEditSubmitRequestSchema,
  adminProductEditDetailSchema,
} from './product-edits.js';

const now = new Date().toISOString();

describe('productEditPhotoSchema', () => {
  it('parses a retained entry with distinct sourceProductPhotoId and a staged entry', () => {
    const sourceId = randomUUID();
    const editPhotoId = randomUUID();
    const retained = {
      id: editPhotoId,
      sourceProductPhotoId: sourceId,
      position: 0,
      retained: true,
      thumbnailUrl: '/a',
      displayUrl: '/b',
    };
    const staged = {
      id: randomUUID(),
      sourceProductPhotoId: null,
      position: 1,
      retained: false,
      thumbnailUrl: '/c',
      displayUrl: '/d',
    };
    const parsedRetained = productEditPhotoSchema.parse(retained);
    expect(parsedRetained.retained).toBe(true);
    expect(parsedRetained.sourceProductPhotoId).toBe(sourceId);
    expect(parsedRetained.id).toBe(editPhotoId);
    expect(productEditPhotoSchema.parse(staged).retained).toBe(false);
  });

  it('rejects a position outside 0..4', () => {
    expect(() =>
      productEditPhotoSchema.parse({ id: randomUUID(), position: 5, retained: true, thumbnailUrl: '/a', displayUrl: '/b' }),
    ).toThrow();
  });
});

describe('productEditRowSchema', () => {
  it('parses a full revision row', () => {
    const row = {
      id: randomUUID(),
      productId: randomUUID(),
      status: 'pending' as const,
      version: 1,
      baseProductVersion: 3,
      name: 'Milk',
      description: null,
      brand: null,
      category: null,
      defaultShelfLifeDays: 14,
      notes: 'Packaging says 14 days',
      photos: [],
      moderationFeedback: null,
      submittedAt: now,
      updatedAt: now,
    };
    expect(productEditRowSchema.parse(row)).toEqual(row);
  });

  it('accepts null defaultShelfLifeDays and notes', () => {
    const row = {
      id: randomUUID(),
      productId: randomUUID(),
      status: 'draft' as const,
      version: 1,
      baseProductVersion: 1,
      name: 'Milk',
      description: null,
      brand: null,
      category: null,
      defaultShelfLifeDays: null,
      notes: null,
      photos: [],
      moderationFeedback: null,
      submittedAt: null,
      updatedAt: now,
    };
    expect(productEditRowSchema.parse(row)).toEqual(row);
  });

  it('accepts historical rows omitting defaultShelfLifeDays and notes', () => {
    const historical = {
      id: randomUUID(),
      productId: randomUUID(),
      status: 'draft' as const,
      version: 1,
      baseProductVersion: 1,
      name: 'Milk',
      description: null,
      brand: null,
      category: null,
      photos: [],
      moderationFeedback: null,
      submittedAt: null,
      updatedAt: now,
    };
    expect(productEditRowSchema.parse(historical)).toEqual(historical);
  });

  it('accepts string notes in row schema for historical compatibility', () => {
    const base = {
      id: randomUUID(),
      productId: randomUUID(),
      status: 'draft' as const,
      version: 1,
      baseProductVersion: 1,
      name: 'Milk',
      description: null,
      brand: null,
      category: null,
      defaultShelfLifeDays: null,
      photos: [],
      moderationFeedback: null,
      submittedAt: null,
      updatedAt: now,
    };
    expect(productEditRowSchema.parse({ ...base, notes: 'Valid Note' }).notes).toBe('Valid Note');
    expect(productEditRowSchema.parse({ ...base, notes: 'superseded:stale_base_version' }).notes).toBe('superseded:stale_base_version');
  });
  it('rejects invalid defaultShelfLifeDays bounds', () => {
    const base = {
      id: randomUUID(),
      productId: randomUUID(),
      status: 'draft' as const,
      version: 1,
      baseProductVersion: 1,
      name: 'Milk',
      description: null,
      brand: null,
      category: null,
      notes: null,
      photos: [],
      moderationFeedback: null,
      submittedAt: null,
      updatedAt: now,
    };
    expect(() => productEditRowSchema.parse({ ...base, defaultShelfLifeDays: 0 })).toThrow();
    expect(() => productEditRowSchema.parse({ ...base, defaultShelfLifeDays: -5 })).toThrow();
    expect(() => productEditRowSchema.parse({ ...base, defaultShelfLifeDays: 3651 })).toThrow();
    expect(() => productEditRowSchema.parse({ ...base, defaultShelfLifeDays: 14.5 })).toThrow();
  });

  it('rejects unknown fields (strict)', () => {
    const row = {
      id: randomUUID(),
      productId: randomUUID(),
      status: 'draft' as const,
      version: 1,
      baseProductVersion: 1,
      name: 'Milk',
      description: null,
      brand: null,
      category: null,
      defaultShelfLifeDays: null,
      notes: null,
      photos: [],
      moderationFeedback: null,
      submittedAt: null,
      updatedAt: now,
      unexpected: 'nope',
    };
    expect(() => productEditRowSchema.parse(row)).toThrow();
  });
});

describe('productEditMetadataPatchRequestSchema', () => {
  it('requires version and accepts a partial metadata patch', () => {
    expect(() => productEditMetadataPatchRequestSchema.parse({ name: 'New' })).toThrow();
    expect(productEditMetadataPatchRequestSchema.parse({ version: 2, name: 'New' })).toEqual({ version: 2, name: 'New' });
  });

  it('allows clearing brand/category/defaultShelfLifeDays/notes to null but not name', () => {
    expect(
      productEditMetadataPatchRequestSchema.parse({
        version: 1,
        brand: null,
        category: null,
        defaultShelfLifeDays: null,
        notes: null,
      }),
    ).toEqual({
      version: 1,
      brand: null,
      category: null,
      defaultShelfLifeDays: null,
      notes: null,
    });
    expect(() => productEditMetadataPatchRequestSchema.parse({ version: 1, name: '' })).toThrow();
  });

  it('validates defaultShelfLifeDays bounds in patch request', () => {
    expect(productEditMetadataPatchRequestSchema.parse({ version: 1, defaultShelfLifeDays: 1 })).toEqual({
      version: 1,
      defaultShelfLifeDays: 1,
    });
    expect(productEditMetadataPatchRequestSchema.parse({ version: 1, defaultShelfLifeDays: 3650 })).toEqual({
      version: 1,
      defaultShelfLifeDays: 3650,
    });
    expect(() => productEditMetadataPatchRequestSchema.parse({ version: 1, defaultShelfLifeDays: 0 })).toThrow();
    expect(() => productEditMetadataPatchRequestSchema.parse({ version: 1, defaultShelfLifeDays: 3651 })).toThrow();
    expect(() => productEditMetadataPatchRequestSchema.parse({ version: 1, defaultShelfLifeDays: 10.5 })).toThrow();
  });

  it('validates notes length and non-empty string in patch request', () => {
    expect(productEditMetadataPatchRequestSchema.parse({ version: 1, notes: 'Valid note' })).toEqual({
      version: 1,
      notes: 'Valid note',
    });
    // Trimmed whitespace-only note should be rejected by min(1)
    expect(() => productEditMetadataPatchRequestSchema.parse({ version: 1, notes: '   ' })).toThrow();
    expect(() => productEditMetadataPatchRequestSchema.parse({ version: 1, notes: 'a'.repeat(1001) })).toThrow();
  });
});

describe('productEditPhotoReorderRequestSchema', () => {
  it('rejects duplicate ids and accepts a valid unique set', () => {
    const id = randomUUID();
    expect(() => productEditPhotoReorderRequestSchema.parse({ photoIds: [id, id] })).toThrow();
    expect(productEditPhotoReorderRequestSchema.parse({ photoIds: [id] })).toEqual({ photoIds: [id] });
  });
});

describe('productEditSubmitRequestSchema', () => {
  it('requires a positive integer version', () => {
    expect(() => productEditSubmitRequestSchema.parse({})).toThrow();
    expect(() => productEditSubmitRequestSchema.parse({ version: 0 })).toThrow();
    expect(productEditSubmitRequestSchema.parse({ version: 1 })).toEqual({ version: 1 });
  });
});

describe('adminProductEditDetailSchema', () => {
  it('parses the creator row shape plus submittedBy and liveProductVersion', () => {
    const detail = {
      id: randomUUID(),
      productId: randomUUID(),
      status: 'pending' as const,
      version: 1,
      baseProductVersion: 3,
      name: 'Milk',
      description: null,
      brand: null,
      category: null,
      defaultShelfLifeDays: 30,
      notes: 'Updated shelf life',
      photos: [],
      moderationFeedback: 'looks good',
      submittedAt: now,
      updatedAt: now,
      submittedBy: randomUUID(),
      liveProductVersion: 3,
    };
    expect(adminProductEditDetailSchema.parse(detail)).toEqual(detail);
  });

  it('requires submittedBy and liveProductVersion', () => {
    const base = {
      id: randomUUID(),
      productId: randomUUID(),
      status: 'pending' as const,
      version: 1,
      baseProductVersion: 1,
      name: 'Milk',
      description: null,
      brand: null,
      category: null,
      defaultShelfLifeDays: null,
      notes: null,
      photos: [],
      moderationFeedback: null,
      submittedAt: null,
      updatedAt: now,
    };
    expect(() => adminProductEditDetailSchema.parse(base)).toThrow();
  });
});
