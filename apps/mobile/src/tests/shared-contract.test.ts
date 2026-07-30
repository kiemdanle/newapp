// Proves the vendored `@expyrico/shared` dist actually resolves the Phase 1
// draft/lookup contracts mobile depends on, catching stale-vendored-copy drift
// (docs/code-standards.md "Vendored shared packages") before it reaches a build.
import { randomUUID } from 'crypto';
import {
  productLookupV2ResponseSchema,
  productDraftsQuerySchema,
  productDraftsPageSchema,
  versionConflictProblemSchema,
  ERROR_CODES,
} from '@expyrico/shared';

describe('resolved @expyrico/shared contract', () => {
  it('parses the under_review lookup outcome with nothing else attached', () => {
    expect(productLookupV2ResponseSchema.parse({ outcome: 'under_review' })).toEqual({
      outcome: 'under_review',
    });
  });

  it('parses the creator_pending lookup outcome with a product', () => {
    const now = new Date().toISOString();
    const product = {
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
      status: 'pending',
      version: 1,
      moderationFeedback: null,
      photos: [],
      createdAt: now,
      updatedAt: now,
    };
    expect(
      productLookupV2ResponseSchema.parse({ outcome: 'creator_pending', product }),
    ).toEqual({ outcome: 'creator_pending', product });
  });

  it('defaults productDraftsQuerySchema limit to 20', () => {
    expect(productDraftsQuerySchema.parse({})).toEqual({ limit: 20 });
  });

  it('parses an empty productDraftsPageSchema page', () => {
    expect(productDraftsPageSchema.parse({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('parses a version_conflict problem and exposes its stable error code', () => {
    expect(ERROR_CODES.VERSION_CONFLICT).toBe('version_conflict');
    expect(
      versionConflictProblemSchema.parse({
        title: 'Version conflict',
        status: 409,
        code: 'version_conflict',
        currentVersion: 2,
      }),
    ).toMatchObject({ code: 'version_conflict', currentVersion: 2 });
  });
});
