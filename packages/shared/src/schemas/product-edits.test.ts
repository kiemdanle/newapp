import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  productEditPhotoSchema,
  productEditRowSchema,
  productEditMetadataPatchRequestSchema,
  productEditPhotoReorderRequestSchema,
  productEditSubmitRequestSchema,
} from './product-edits.js';

const now = new Date().toISOString();

describe('productEditPhotoSchema', () => {
  it('parses a retained and a staged entry identically shaped', () => {
    const retained = { id: randomUUID(), position: 0, retained: true, thumbnailUrl: '/a', displayUrl: '/b' };
    const staged = { id: randomUUID(), position: 1, retained: false, thumbnailUrl: '/c', displayUrl: '/d' };
    expect(productEditPhotoSchema.parse(retained).retained).toBe(true);
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
      photos: [],
      moderationFeedback: null,
      submittedAt: now,
      updatedAt: now,
    };
    expect(productEditRowSchema.parse(row)).toEqual(row);
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

  it('allows clearing brand/category to null but not name', () => {
    expect(productEditMetadataPatchRequestSchema.parse({ version: 1, brand: null, category: null })).toEqual({
      version: 1,
      brand: null,
      category: null,
    });
    expect(() => productEditMetadataPatchRequestSchema.parse({ version: 1, name: '' })).toThrow();
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
