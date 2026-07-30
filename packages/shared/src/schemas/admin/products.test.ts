import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  adminProductStatusSchema,
  adminProductEditRowSchema,
  adminProductRowSchema,
  productEditStatusSchema,
  adminProductEditResolveSchema,
  adminProductModerateRequestSchema,
  productEditRecoverRequestSchema,
  adminProductMergeSchema,
  type AdminProductEditResolveDecision,
  type AdminProductModerateDecision,
  type AdminProductMerge,
} from './products.js';

const now = new Date().toISOString();

describe('adminProductRowSchema', () => {
  const base = {
    id: randomUUID(),
    barcode: null,
    qrPayload: null,
    name: 'Milk',
    brand: null,
    category: null,
    imageUrl: null,
    source: 'user' as const,
    status: 'pending' as const,
    isCommunityEligible: false,
    buyAgainCount: 0,
    buyAgainOnSaleCount: 0,
    wontBuyCount: 0,
    ratingCount: 0,
    reviewCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  it('parses without the optional review-media/moderation-history fields', () => {
    expect(adminProductRowSchema.parse(base)).toMatchObject({ id: base.id, name: 'Milk' });
  });

  it('parses ordered review photos and moderation history when present', () => {
    const withReview = {
      ...base,
      photos: [{ id: randomUUID(), position: 0, thumbnailUrl: '/v1/products/x/photos/y/thumb', displayUrl: '/v1/products/x/photos/y/display' }],
      moderationNotes: 'add a clearer name',
      moderatedAt: now,
    };
    const parsed = adminProductRowSchema.parse(withReview);
    expect(parsed.photos).toHaveLength(1);
    expect(parsed.moderationNotes).toBe('add a clearer name');
  });
});

describe('adminProductStatusSchema', () => {
  it('includes the full product lifecycle', () => {
    for (const status of ['draft', 'pending', 'changes_required', 'active', 'report_hidden', 'merged_into']) {
      expect(adminProductStatusSchema.parse(status)).toBe(status);
    }
  });
});

describe('productEditStatusSchema', () => {
  it('accepts every revision status, preserving rejected as terminal history', () => {
    for (const status of ['draft', 'pending', 'changes_required', 'approved', 'rejected']) {
      expect(productEditStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects an unknown status', () => {
    expect(() => productEditStatusSchema.parse('archived')).toThrow();
  });
});

describe('adminProductEditRowSchema', () => {
  it('parses a full revision row with versioning and moderation fields', () => {
    const row = {
      id: randomUUID(),
      productId: randomUUID(),
      submittedBy: randomUUID(),
      proposed: { name: 'New name' },
      status: 'pending',
      version: 2,
      baseProductVersion: 1,
      moderationNotes: null,
      submittedAt: now,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
    };
    expect(adminProductEditRowSchema.parse(row)).toEqual(row);
  });

  it('accepts the draft and changes_required states', () => {
    const base = {
      id: randomUUID(),
      productId: randomUUID(),
      submittedBy: randomUUID(),
      proposed: {},
      version: 1,
      baseProductVersion: 1,
      moderationNotes: 'Please add a photo',
      submittedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
    };
    expect(adminProductEditRowSchema.parse({ ...base, status: 'draft' }).status).toBe('draft');
    expect(adminProductEditRowSchema.parse({ ...base, status: 'changes_required' }).status).toBe(
      'changes_required',
    );
  });
});

describe('adminProductEditResolveSchema', () => {
  it('names the admin action request_changes rather than reject', () => {
    expect(adminProductEditResolveSchema.parse({ decision: 'approve' })).toEqual({
      decision: 'approve',
    });
    expect(
      adminProductEditResolveSchema.parse({ decision: 'request_changes', notes: 'fix the title' }),
    ).toEqual({ decision: 'request_changes', notes: 'fix the title' });
  });

  it('rejects the legacy reject decision', () => {
    expect(() => adminProductEditResolveSchema.parse({ decision: 'reject' })).toThrow();
  });

  it('requires notes when requesting changes', () => {
    expect(() => adminProductEditResolveSchema.parse({ decision: 'request_changes' })).toThrow();
  });
});

describe('adminProductModerateRequestSchema', () => {
  it('accepts approve without notes and requires a version', () => {
    expect(adminProductModerateRequestSchema.parse({ decision: 'approve', version: 1 })).toEqual({
      decision: 'approve',
      version: 1,
    });
    expect(() => adminProductModerateRequestSchema.parse({ decision: 'approve' })).toThrow();
  });

  it('requires notes when requesting changes', () => {
    expect(() =>
      adminProductModerateRequestSchema.parse({ decision: 'request_changes', version: 1 }),
    ).toThrow();
    expect(
      adminProductModerateRequestSchema.parse({
        decision: 'request_changes',
        version: 1,
        notes: 'add a real name',
      }),
    ).toEqual({ decision: 'request_changes', version: 1, notes: 'add a real name' });
  });

  it('rejects the legacy reject decision and a non-positive version', () => {
    expect(() => adminProductModerateRequestSchema.parse({ decision: 'reject', version: 1 })).toThrow();
    expect(() => adminProductModerateRequestSchema.parse({ decision: 'approve', version: 0 })).toThrow();
  });
});

describe('AdminProductEditResolveDecision', () => {
  it('is the exact schema-derived literal union — a compile-time drift guard', () => {
    // If a future rename changes the schema's decision literals without updating
    // callers, this line fails `tsc` instead of only failing at runtime in admin.
    const decisions: AdminProductEditResolveDecision[] = ['approve', 'request_changes'];
    expect(decisions).toEqual(['approve', 'request_changes']);
    // @ts-expect-error 'reject' is not a valid decision after the request_changes rename
    const legacyRejectIsNoLongerValid: AdminProductEditResolveDecision = 'reject';
    expect(legacyRejectIsNoLongerValid).toBe('reject');
  });
});

describe('productEditRecoverRequestSchema', () => {
  it('accepts a rebase action with a unique reviewed desired-photo mapping', () => {
    const sourceId = randomUUID();
    const editPhotoId = randomUUID();
    const parsed = productEditRecoverRequestSchema.parse({
      action: 'rebase',
      editVersion: 2,
      productVersion: 5,
      desiredPhotoOrder: [
        { type: 'retained', sourceProductPhotoId: sourceId },
        { type: 'staged', editPhotoId },
      ],
    });
    expect(parsed).toMatchObject({ action: 'rebase' });
  });

  it('rejects a rebase mapping with duplicate entries', () => {
    const sourceId = randomUUID();
    expect(() =>
      productEditRecoverRequestSchema.parse({
        action: 'rebase',
        editVersion: 1,
        productVersion: 1,
        desiredPhotoOrder: [
          { type: 'retained', sourceProductPhotoId: sourceId },
          { type: 'retained', sourceProductPhotoId: sourceId },
        ],
      }),
    ).toThrow();
  });

  it('accepts a supersede action without a photo mapping', () => {
    const parsed = productEditRecoverRequestSchema.parse({
      action: 'supersede',
      editVersion: 3,
      productVersion: 7,
    });
    expect(parsed).toEqual({ action: 'supersede', editVersion: 3, productVersion: 7 });
  });

  it('rejects an unknown action', () => {
    expect(() =>
      productEditRecoverRequestSchema.parse({ action: 'approve', editVersion: 1, productVersion: 1 }),
    ).toThrow();
  });
});

describe('AdminProductModerateDecision', () => {
  it('is the exact schema-derived literal union — a compile-time drift guard', () => {
    const decisions: AdminProductModerateDecision[] = ['approve', 'request_changes'];
    expect(decisions).toEqual(['approve', 'request_changes']);
  });
});

describe('adminProductMergeSchema', () => {
  it('accepts targetId/sourceIds/version and rejects the legacy winnerId/loserIds shape', () => {
    const target = randomUUID();
    const source = randomUUID();
    expect(adminProductMergeSchema.parse({ targetId: target, sourceIds: [source], version: 1 })).toEqual({
      targetId: target,
      sourceIds: [source],
      version: 1,
    });
    // The old field names must no longer satisfy the schema — this is exactly the
    // contract every consumer (admin client, mobile vendored copy) must be updated
    // for (I6); a stray old-shape caller should fail loudly, not silently 400 at
    // the HTTP boundary with no compile-time signal.
    expect(() => adminProductMergeSchema.parse({ winnerId: target, loserIds: [source] })).toThrow();
  });

  it('rejects target-as-source and duplicate sourceIds', () => {
    const target = randomUUID();
    expect(() => adminProductMergeSchema.parse({ targetId: target, sourceIds: [target], version: 1 })).toThrow();
    const source = randomUUID();
    expect(() => adminProductMergeSchema.parse({ targetId: target, sourceIds: [source, source], version: 1 })).toThrow();
  });

  it('requires version', () => {
    expect(() => adminProductMergeSchema.parse({ targetId: randomUUID(), sourceIds: [randomUUID()] })).toThrow();
  });
});

describe('AdminProductMerge', () => {
  it('is the exact schema-derived field set — a compile-time drift guard against a future silent rename', () => {
    const sample: AdminProductMerge = { targetId: randomUUID(), sourceIds: [randomUUID()], version: 1 };
    expect(Object.keys(sample).sort()).toEqual(['sourceIds', 'targetId', 'version']);
  });
});
