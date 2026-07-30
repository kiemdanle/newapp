import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  productStatusSchema,
  productDescriptionValueSchema,
  productPhotoSchema,
  productSchema,
  productLookupV2ResponseSchema,
  productDraftsQuerySchema,
  productDraftRowSchema,
  productDraftsPageSchema,
  productDraftCreateRequestSchema,
  productDraftPatchRequestSchema,
  productDraftReorderRequestSchema,
  productDraftSubmitRequestSchema,
} from './product.js';

const now = new Date().toISOString();

function makeProduct(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: randomUUID(),
    barcode: '5449000000996',
    qrPayload: null,
    name: 'Coke',
    description: null,
    brand: null,
    category: null,
    imageUrl: null,
    defaultShelfLifeDays: null,
    source: 'user',
    sourceId: null,
    isCommunityEligible: false,
    buyAgainCount: 0,
    buyAgainOnSaleCount: 0,
    wontBuyCount: 0,
    ratingCount: 0,
    reviewCount: 0,
    status: 'active',
    version: 1,
    photos: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('productStatusSchema', () => {
  it('accepts every lifecycle state', () => {
    for (const status of ['draft', 'pending', 'changes_required', 'active', 'report_hidden', 'merged_into']) {
      expect(productStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects unknown statuses', () => {
    expect(() => productStatusSchema.parse('deleted')).toThrow();
  });
});

describe('productSchema', () => {
  it('parses a full product including photos', () => {
    const photo = {
      id: randomUUID(),
      position: 0,
      thumbnailUrl: 'https://api.example.com/v1/products/photos/abc/thumbnail',
      displayUrl: 'https://api.example.com/v1/products/photos/abc/display',
    };
    const product = makeProduct({ photos: [photo] });
    expect(productSchema.parse(product)).toEqual(product);
  });

  it('never exposes moderation feedback on the public product DTO', () => {
    const parsed = productSchema.parse(makeProduct());
    expect(parsed).not.toHaveProperty('moderationFeedback');
    // Stripped even if a caller accidentally forwards it — productSchema is not
    // `.strict()`, so extra keys are silently dropped, never surfaced.
    const withStrayFeedback = productSchema.parse(
      makeProduct({ moderationFeedback: 'internal note' } as Record<string, unknown>),
    );
    expect(withStrayFeedback).not.toHaveProperty('moderationFeedback');
  });

  it('never requires storage keys or moderation internals on the public photo shape', () => {
    const photo = {
      id: randomUUID(),
      position: 0,
      thumbnailUrl: 'https://api.example.com/v1/products/photos/abc/thumbnail',
      displayUrl: 'https://api.example.com/v1/products/photos/abc/display',
      privateStorageKey: 'should-not-be-here',
    };
    const parsed = productPhotoSchema.parse(photo);
    expect(parsed).not.toHaveProperty('privateStorageKey');
    expect(parsed).not.toHaveProperty('uploadedByUserId');
    expect(parsed).not.toHaveProperty('moderationStatus');
  });
});

describe('productDescriptionValueSchema', () => {
  it('normalizes blank input to null', () => {
    expect(productDescriptionValueSchema.parse('   ')).toBeNull();
    expect(productDescriptionValueSchema.parse('')).toBeNull();
    expect(productDescriptionValueSchema.parse(null)).toBeNull();
  });

  it('requires a value: does not silently accept undefined', () => {
    expect(() => productDescriptionValueSchema.parse(undefined)).toThrow();
  });

  it('trims surrounding whitespace', () => {
    expect(productDescriptionValueSchema.parse('  hello world  ')).toBe('hello world');
  });

  it('permits tab and newline', () => {
    expect(productDescriptionValueSchema.parse('line one\nline two\tindented')).toBe(
      'line one\nline two\tindented',
    );
  });

  it('preserves Unicode and literal markup as plain text', () => {
    const value = 'Café ☕ <b>not html</b> — tastes great 中文';
    expect(productDescriptionValueSchema.parse(value)).toBe(value);
  });

  it('rejects other C0 control characters', () => {
    expect(() => productDescriptionValueSchema.parse('badbell')).toThrow();
    expect(() => productDescriptionValueSchema.parse('badvtab')).toThrow();
    expect(() => productDescriptionValueSchema.parse('bad\rcarriage')).toThrow();
  });

  it('rejects C1 control characters', () => {
    expect(() => productDescriptionValueSchema.parse('badc1')).toThrow();
  });

  it('rejects text over 2000 characters after trim', () => {
    expect(() => productDescriptionValueSchema.parse('a'.repeat(2001))).toThrow();
    expect(productDescriptionValueSchema.parse('a'.repeat(2000))).toHaveLength(2000);
  });
});

describe('productLookupV2ResponseSchema', () => {
  it('round-trips found with a full product', () => {
    const product = makeProduct();
    expect(productLookupV2ResponseSchema.parse({ outcome: 'found', product })).toEqual({
      outcome: 'found',
      product,
    });
  });

  it('round-trips editable_private and creator_pending with a product', () => {
    const product = makeProduct({ status: 'draft' });
    expect(productLookupV2ResponseSchema.parse({ outcome: 'editable_private', product })).toEqual({
      outcome: 'editable_private',
      product,
    });
    const pendingProduct = makeProduct({ status: 'pending' });
    expect(
      productLookupV2ResponseSchema.parse({ outcome: 'creator_pending', product: pendingProduct }),
    ).toEqual({ outcome: 'creator_pending', product: pendingProduct });
  });

  it('under_review discloses nothing beyond the outcome', () => {
    expect(productLookupV2ResponseSchema.parse({ outcome: 'under_review' })).toEqual({
      outcome: 'under_review',
    });
    expect(() =>
      productLookupV2ResponseSchema.parse({ outcome: 'under_review', productId: randomUUID() }),
    ).toThrow();
    expect(() =>
      productLookupV2ResponseSchema.parse({ outcome: 'under_review', creator: 'someone' }),
    ).toThrow();
  });

  it('not_found requires canCreate and nothing else', () => {
    expect(productLookupV2ResponseSchema.parse({ outcome: 'not_found', canCreate: true })).toEqual({
      outcome: 'not_found',
      canCreate: true,
    });
    expect(() => productLookupV2ResponseSchema.parse({ outcome: 'not_found' })).toThrow();
  });

  it('temporarily_unavailable makes retryAfterSeconds optional', () => {
    expect(productLookupV2ResponseSchema.parse({ outcome: 'temporarily_unavailable' })).toEqual({
      outcome: 'temporarily_unavailable',
    });
    expect(
      productLookupV2ResponseSchema.parse({ outcome: 'temporarily_unavailable', retryAfterSeconds: 30 }),
    ).toEqual({ outcome: 'temporarily_unavailable', retryAfterSeconds: 30 });
  });

  it('rejects an unknown outcome', () => {
    expect(() => productLookupV2ResponseSchema.parse({ outcome: 'maybe' })).toThrow();
  });
});

describe('productDraftsQuerySchema', () => {
  it('defaults limit to 20 and leaves cursor/status undefined', () => {
    expect(productDraftsQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it('coerces and bounds limit to 1..50', () => {
    expect(productDraftsQuerySchema.parse({ limit: '5' })).toMatchObject({ limit: 5 });
    expect(() => productDraftsQuerySchema.parse({ limit: 0 })).toThrow();
    expect(() => productDraftsQuerySchema.parse({ limit: 51 })).toThrow();
  });

  it('accepts only creator-private statuses', () => {
    for (const status of ['draft', 'pending', 'changes_required']) {
      expect(productDraftsQuerySchema.parse({ status }).status).toBe(status);
    }
    expect(() => productDraftsQuerySchema.parse({ status: 'active' })).toThrow();
    expect(() => productDraftsQuerySchema.parse({ status: 'report_hidden' })).toThrow();
  });

  it('accepts an opaque cursor string', () => {
    expect(productDraftsQuerySchema.parse({ cursor: 'abc123' }).cursor).toBe('abc123');
  });
});

describe('productDraftRowSchema and productDraftsPageSchema', () => {
  const row = {
    id: randomUUID(),
    name: 'Mystery Snack',
    identifier: { kind: 'barcode', value: '5449000000996' },
    status: 'draft',
    version: 1,
    moderationFeedback: null,
    cover: null,
    updatedAt: now,
  };

  it('accepts a barcode or qr discriminated identifier, never both', () => {
    expect(productDraftRowSchema.parse(row)).toEqual(row);
    const qrRow = { ...row, identifier: { kind: 'qr', value: 'qr-payload' } };
    expect(productDraftRowSchema.parse(qrRow)).toEqual(qrRow);
    expect(() =>
      productDraftRowSchema.parse({
        ...row,
        identifier: { kind: 'barcode', value: '123456', extra: 'nope' },
      }),
    ).toThrow();
  });

  it('exposes an authorized cover thumbnail route, never a storage key', () => {
    const withCover = {
      ...row,
      cover: { photoId: randomUUID(), thumbnailUrl: 'https://api.example.com/v1/products/photos/x' },
    };
    expect(productDraftRowSchema.parse(withCover)).toEqual(withCover);
    expect(() =>
      productDraftRowSchema.parse({
        ...row,
        cover: { photoId: randomUUID(), thumbnailUrl: 'x', privateStorageKey: 'leak' },
      }),
    ).toThrow();
  });

  it('carries caller-visible feedback and ISO updatedAt', () => {
    const withFeedback = { ...row, moderationFeedback: 'Please add a clearer photo.' };
    expect(productDraftRowSchema.parse(withFeedback).moderationFeedback).toBe(
      'Please add a clearer photo.',
    );
    expect(() => productDraftRowSchema.parse({ ...row, updatedAt: 'not-a-date' })).toThrow();
  });

  it('rejects a non-private status', () => {
    expect(() => productDraftRowSchema.parse({ ...row, status: 'active' })).toThrow();
  });

  it('paginates with a nullable cursor', () => {
    expect(productDraftsPageSchema.parse({ items: [row], nextCursor: null })).toEqual({
      items: [row],
      nextCursor: null,
    });
    expect(productDraftsPageSchema.parse({ items: [], nextCursor: 'opaque' }).nextCursor).toBe(
      'opaque',
    );
  });
});

describe('productDraftCreateRequestSchema', () => {
  it('requires exactly one of barcode or qrPayload', () => {
    expect(productDraftCreateRequestSchema.parse({ barcode: '5449000000996' })).toEqual({
      barcode: '5449000000996',
    });
    expect(productDraftCreateRequestSchema.parse({ qrPayload: 'qr-data' })).toEqual({
      qrPayload: 'qr-data',
    });
    expect(() => productDraftCreateRequestSchema.parse({})).toThrow();
    expect(() =>
      productDraftCreateRequestSchema.parse({ barcode: '5449000000996', qrPayload: 'qr-data' }),
    ).toThrow();
  });
});

describe('productDraftPatchRequestSchema', () => {
  it('accepts a partial metadata patch and normalizes description', () => {
    expect(
      productDraftPatchRequestSchema.parse({ name: 'New name', description: '  hi  ' }),
    ).toEqual({ name: 'New name', description: 'hi' });
  });

  it('leaves description untouched (key omitted) when the caller omits it', () => {
    const parsed = productDraftPatchRequestSchema.parse({ name: 'New name' });
    expect(parsed).toEqual({ name: 'New name' });
    expect('description' in parsed).toBe(false);
  });

  it('clears description (explicit null) only when the caller sends null', () => {
    expect(productDraftPatchRequestSchema.parse({ description: null })).toEqual({
      description: null,
    });
  });

  it('treats an empty payload as a true no-op patch', () => {
    const parsed = productDraftPatchRequestSchema.parse({});
    expect(Object.keys(parsed)).toHaveLength(0);
  });

  it('rejects unknown fields', () => {
    expect(() => productDraftPatchRequestSchema.parse({ imageUrl: 'https://x' })).toThrow();
  });
});

describe('productDraftReorderRequestSchema', () => {
  it('accepts one to five unique ordered photo ids', () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    expect(productDraftReorderRequestSchema.parse({ photoIds: ids })).toEqual({ photoIds: ids });
  });

  it('rejects duplicate ids and more than five entries', () => {
    const id = randomUUID();
    expect(() => productDraftReorderRequestSchema.parse({ photoIds: [id, id] })).toThrow();
    const six = Array.from({ length: 6 }, () => randomUUID());
    expect(() => productDraftReorderRequestSchema.parse({ photoIds: six })).toThrow();
    expect(() => productDraftReorderRequestSchema.parse({ photoIds: [] })).toThrow();
  });
});

describe('productDraftSubmitRequestSchema', () => {
  it('requires version and abuseToken', () => {
    expect(productDraftSubmitRequestSchema.parse({ version: 1, abuseToken: 'tok' })).toEqual({
      version: 1,
      abuseToken: 'tok',
    });
    expect(() => productDraftSubmitRequestSchema.parse({ version: 1 })).toThrow();
    expect(() => productDraftSubmitRequestSchema.parse({ abuseToken: 'tok' })).toThrow();
  });
});
