import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { toApiProduct } from '../../src/services/products/serializer.js';

const now = new Date();

function makePrismaProduct(overrides: Partial<Record<string, unknown>> = {}) {
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
    moderationNotes: null,
    createdByUserId: null,
    mergedIntoProductId: null,
    submittedAt: null,
    moderatedAt: null,
    moderatedByUserId: null,
    createdAt: now,
    updatedAt: now,
    photos: [],
    ...overrides,
  };
}

function makePrismaPhoto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: randomUUID(),
    productId: randomUUID(),
    position: 0,
    uploadedByUserId: randomUUID(),
    moderationStatus: 'approved',
    moderationNote: null,
    privateStorageKey: null,
    publicStorageKey: 'public/abc.webp',
    mimeType: 'image/webp',
    displayByteSize: 1000,
    displayWidth: 800,
    displayHeight: 600,
    thumbnailByteSize: 100,
    thumbnailWidth: 200,
    thumbnailHeight: 150,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('toApiProduct', () => {
  it('maps description and version', () => {
    const product = makePrismaProduct({ description: 'Tastes great', version: 3 });
    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' });
    expect(api.description).toBe('Tastes great');
    expect(api.version).toBe(3);
  });

  it('defaults description to null and version to 1 when absent', () => {
    const product = makePrismaProduct({ description: null, version: 1 });
    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' });
    expect(api.description).toBeNull();
    expect(api.version).toBe(1);
  });

  it('never exposes moderationNotes as moderationFeedback on the public DTO', () => {
    const product = makePrismaProduct({ moderationNotes: 'Blurry cover photo' });
    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' });
    expect(api).not.toHaveProperty('moderationFeedback');
    expect(JSON.stringify(api)).not.toContain('Blurry cover photo');
  });

  it('maps ordered photos to the public shape only', () => {
    const photo = makePrismaPhoto({ position: 0 });
    const product = makePrismaProduct({ photos: [photo] });
    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' });
    expect(api.photos).toHaveLength(1);
    expect(api.photos[0]).toEqual({
      id: photo.id,
      position: 0,
      thumbnailUrl: expect.any(String),
      displayUrl: expect.any(String),
    });
  });

  it('redacts storage keys, uploader, and moderation internals from every photo', () => {
    const photo = makePrismaPhoto({ position: 1 });
    const product = makePrismaProduct({ photos: [photo] });
    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' });
    const serialized = JSON.stringify(api.photos[0]);
    expect(serialized).not.toContain('StorageKey');
    expect(serialized).not.toContain('uploadedByUserId');
    expect(serialized).not.toContain('moderationStatus');
    expect(serialized).not.toContain('moderationNote');
  });

  it('preserves photo order across multiple photos', () => {
    const photoA = makePrismaPhoto({ position: 0 });
    const photoB = makePrismaPhoto({ position: 1 });
    const product = makePrismaProduct({ photos: [photoA, photoB] });
    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' });
    expect(api.photos.map((p) => p.id)).toEqual([photoA.id, photoB.id]);
  });

  it('sorts photos by position regardless of relation-load order, so cover (0) is always first', () => {
    const photoPos2 = makePrismaPhoto({ position: 2 });
    const photoPos0 = makePrismaPhoto({ position: 0 });
    const photoPos1 = makePrismaPhoto({ position: 1 });
    // Deliberately out of order, as an unordered Prisma `include` would return them.
    const product = makePrismaProduct({ photos: [photoPos2, photoPos0, photoPos1] });
    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' });
    expect(api.photos.map((p) => p.position)).toEqual([0, 1, 2]);
    expect(api.photos.map((p) => p.id)).toEqual([photoPos0.id, photoPos1.id, photoPos2.id]);
  });

  it('defaults to an empty photos array when none are attached', () => {
    const product = makePrismaProduct({ photos: [] });
    expect(toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' }).photos).toEqual([]);
  });
});

describe('toApiProduct — moderation-status photo filtering (reviewer-p3 C2)', () => {
  const ownerId = randomUUID();

  it('omits non-approved photos entirely when no viewer is given a privileged reason to see them', () => {
    const approved = makePrismaPhoto({ moderationStatus: 'approved', position: 0 });
    const pending = makePrismaPhoto({ moderationStatus: 'pending', position: 1, privateStorageKey: 'private/x', publicStorageKey: null });
    const rejected = makePrismaPhoto({ moderationStatus: 'rejected', position: 2, privateStorageKey: 'private/y', publicStorageKey: null });
    const product = makePrismaProduct({ createdByUserId: ownerId, photos: [approved, pending, rejected] });

    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { id: randomUUID(), role: 'user' });
    expect(api.photos.map((p) => p.id)).toEqual([approved.id]);
  });

  it("shows the product's own creator their own still-pending photos, but not a rejected one", () => {
    const pending = makePrismaPhoto({ moderationStatus: 'pending', position: 0, privateStorageKey: 'private/x', publicStorageKey: null });
    const rejected = makePrismaPhoto({ moderationStatus: 'rejected', position: 1, privateStorageKey: 'private/y', publicStorageKey: null });
    const product = makePrismaProduct({ createdByUserId: ownerId, photos: [pending, rejected] });

    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { id: ownerId, role: 'user' });
    expect(api.photos.map((p) => p.id)).toEqual([pending.id]);
  });

  it('shows an admin viewer every photo regardless of moderation status', () => {
    const pending = makePrismaPhoto({ moderationStatus: 'pending', position: 0, privateStorageKey: 'private/x', publicStorageKey: null });
    const rejected = makePrismaPhoto({ moderationStatus: 'rejected', position: 1, privateStorageKey: 'private/y', publicStorageKey: null });
    const product = makePrismaProduct({ createdByUserId: ownerId, photos: [pending, rejected] });

    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { id: randomUUID(), role: 'admin' });
    expect(api.photos.map((p) => p.id).sort()).toEqual([pending.id, rejected.id].sort());
  });

  it('shows every photo for an explicitly privileged viewer — product-photos.ts/product-drafts.ts/product-moderation.ts call sites, already gated upstream (reviewer-p3 R3: the viewer argument is required now, no fail-open default)', () => {
    const pending = makePrismaPhoto({ moderationStatus: 'pending', position: 0, privateStorageKey: 'private/x', publicStorageKey: null });
    const rejected = makePrismaPhoto({ moderationStatus: 'rejected', position: 1, privateStorageKey: 'private/y', publicStorageKey: null });
    const product = makePrismaProduct({ createdByUserId: ownerId, photos: [pending, rejected] });

    const api = toApiProduct(product as Parameters<typeof toApiProduct>[0], { kind: 'privileged' });
    expect(api.photos).toHaveLength(2);
  });
});
