// apps/admin/tests/e2e/mock-store.ts
// In-memory data store for the admin E2E mock API. Seeded with deterministic
// UUID fixtures so specs can target known ids. `POST /v1/dev/reset` re-seeds it
// (see mock-api.ts) so each spec starts from a clean, known state even though
// Playwright reuses one mock-server process across tests.
//
// Every response builder below `.parse()`s its own output against the real
// @expyrico/shared schema the corresponding upstream route actually returns,
// before handing it back. A hand-shaped mock response that
// silently diverges from the real contract then fails loudly right here
// (cheap, in the mock) instead of only surfacing as a confusing client-side
// parse error deep in a spec, or — worse — never surfacing at all, since
// non-strict schemas (like `productSchema`) drop unknown fields the mock
// happens to omit without complaint.
import { productSchema, productWithReviewsSchema } from '@expyrico/shared';

const now = new Date('2026-06-01T00:00:00.000Z').toISOString();

// Stable fixture ids (valid v4-shaped UUIDs) referenced by the specs.
export const FIXTURE = {
  reportId: 'aaaaaaaa-0000-4000-8000-000000000001',
  reviewTargetId: 'aaaaaaaa-0000-4000-8000-000000000002',
  reporterId: 'aaaaaaaa-0000-4000-8000-000000000003',
  winnerProductId: 'bbbbbbbb-0000-4000-8000-000000000001',
  loserProductId: 'bbbbbbbb-0000-4000-8000-000000000002',
  victimUserId: 'cccccccc-0000-4000-8000-000000000001',
  // Phase 6 moderation console fixtures.
  pendingProductId: 'dddddddd-0000-4000-8000-000000000001',
  pendingProductPhotoId: 'dddddddd-0000-4000-8000-000000000002',
  pendingProductSecondPhotoId: 'dddddddd-0000-4000-8000-000000000006',
  activeProductId: 'eeeeeeee-0000-4000-8000-000000000001',
  activeProductPhotoId: 'eeeeeeee-0000-4000-8000-000000000002',
  pendingEditId: 'ffffffff-0000-4000-8000-000000000001',
  stagedEditPhotoId: 'ffffffff-0000-4000-8000-000000000002',
  submitterUserId: 'ffffffff-0000-4000-8000-000000000003',
  staleEditId: 'ffffffff-0000-4000-8000-000000000004',
  staleEditStagedPhotoId: 'ffffffff-0000-4000-8000-000000000005',
} as const;

// A tiny valid 1x1 PNG — stands in for real product-photo bytes; the private
// media routes/proxy under test only care that *a* body and content-type
// travel through, not that it's a decodable webp.
export const MOCK_IMAGE_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export const VICTIM_EMAIL = 'victim@pantry.local';
export const VICTIM_PASSWORD = 'victim-pw-1234';

export interface ReportRow {
  id: string;
  reporterId: string;
  targetType: 'review' | 'user' | 'product';
  targetId: string;
  reason: 'spam' | 'abuse' | 'incorrect' | 'other';
  body: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
  targetPreview: Record<string, unknown> | null;
}

export interface MockProductPhoto {
  id: string;
  position: number;
  moderationStatus: 'pending' | 'approved' | 'rejected';
}

export interface ProductRow {
  id: string;
  barcode: string | null;
  qrPayload: string | null;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: 'off' | 'upcitemdb' | 'user';
  status: 'draft' | 'pending' | 'changes_required' | 'active' | 'report_hidden' | 'merged_into';
  version: number;
  mergedIntoProductId: string | null;
  isCommunityEligible: boolean;
  buyAgainCount: number;
  buyAgainOnSaleCount: number;
  wontBuyCount: number;
  ratingCount: number;
  reviewCount: number;
  photos: MockProductPhoto[];
  createdAt: string;
  updatedAt: string;
}

export interface MockEditPhoto {
  id: string;
  position: number;
  retained: boolean;
  sourceProductPhotoId?: string;
}

export interface ProductEditRow {
  id: string;
  productId: string;
  submittedBy: string;
  status: 'draft' | 'pending' | 'changes_required' | 'approved' | 'rejected';
  version: number;
  baseProductVersion: number;
  name: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  photos: MockEditPhoto[];
  moderationNotes: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  country: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'suspended' | 'deleted';
  createdAt: string;
  lastSeenAt: string | null;
  emailVerifiedAt: string | null;
  totpEnabledAt: string | null;
}

interface Store {
  reports: ReportRow[];
  products: ProductRow[];
  edits: ProductEditRow[];
  users: UserRow[];
}

function product(over: Partial<ProductRow> & Pick<ProductRow, 'id' | 'name'>): ProductRow {
  return {
    barcode: null,
    qrPayload: null,
    description: null,
    brand: null,
    category: null,
    imageUrl: null,
    source: 'user',
    status: 'active',
    version: 1,
    mergedIntoProductId: null,
    isCommunityEligible: false,
    buyAgainCount: 0,
    buyAgainOnSaleCount: 0,
    wontBuyCount: 0,
    ratingCount: 0,
    reviewCount: 0,
    photos: [],
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

function edit(over: Partial<ProductEditRow> & Pick<ProductEditRow, 'id' | 'productId' | 'submittedBy'>): ProductEditRow {
  return {
    status: 'pending',
    version: 1,
    baseProductVersion: 1,
    name: '',
    description: null,
    brand: null,
    category: null,
    photos: [],
    moderationNotes: null,
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
    ...over,
  };
}

export function seed(): Store {
  return {
    reports: [
      {
        id: FIXTURE.reportId,
        reporterId: FIXTURE.reporterId,
        targetType: 'review',
        targetId: FIXTURE.reviewTargetId,
        reason: 'abuse',
        body: 'Offensive language in this review.',
        status: 'open',
        createdAt: now,
        targetPreview: { rating: 'wont_buy', comment: 'This is garbage trash junk.' },
      },
    ],
    products: [
      product({
        id: FIXTURE.winnerProductId,
        name: 'Dup Milk Original',
        brand: 'Acme',
        barcode: 'DUP-0001',
        source: 'off',
        reviewCount: 3,
        ratingCount: 3,
        buyAgainCount: 2,
        wontBuyCount: 1,
      }),
      product({
        id: FIXTURE.loserProductId,
        name: 'Dup Milk Duplicate',
        brand: 'Acme',
        barcode: 'DUP-0002',
        reviewCount: 1,
        ratingCount: 1,
        buyAgainCount: 1,
      }),
      // A brand-new creator submission awaiting moderation — its one photo is
      // unapproved (`pending`), so its URL must be a private route the admin
      // console can only render through the same-origin proxy.
      product({
        id: FIXTURE.pendingProductId,
        name: 'New Scanned Snacks',
        brand: 'Acme',
        status: 'pending',
        version: 1,
        photos: [
          { id: FIXTURE.pendingProductPhotoId, position: 0, moderationStatus: 'pending' },
          { id: FIXTURE.pendingProductSecondPhotoId, position: 1, moderationStatus: 'pending' },
        ],
      }),
      // An already-active product with an open revision against it — used by the
      // revision detail/comparison and photo-manager specs.
      product({
        id: FIXTURE.activeProductId,
        name: 'Active Cereal',
        brand: 'Acme',
        description: 'Live description.',
        status: 'active',
        version: 1,
        photos: [{ id: FIXTURE.activeProductPhotoId, position: 0, moderationStatus: 'approved' }],
      }),
    ],
    edits: [
      edit({
        id: FIXTURE.pendingEditId,
        productId: FIXTURE.activeProductId,
        submittedBy: FIXTURE.submitterUserId,
        name: 'Active Cereal (renamed)',
        description: 'Proposed description.',
        baseProductVersion: 1,
        photos: [
          { id: FIXTURE.activeProductPhotoId, position: 0, retained: true, sourceProductPhotoId: FIXTURE.activeProductPhotoId },
          { id: FIXTURE.stagedEditPhotoId, position: 1, retained: false },
        ],
      }),
      // Deliberately stale: `baseProductVersion` (1) no longer matches the live
      // product's actual version once a spec bumps it — exercises the recovery
      // (rebase/supersede) path instead of ordinary approve/request-changes.
      edit({
        id: FIXTURE.staleEditId,
        productId: FIXTURE.activeProductId,
        submittedBy: FIXTURE.submitterUserId,
        name: 'Active Cereal (stale revision)',
        baseProductVersion: 1,
        photos: [{ id: FIXTURE.staleEditStagedPhotoId, position: 0, retained: false }],
      }),
    ],
    users: [
      {
        id: FIXTURE.victimUserId,
        email: VICTIM_EMAIL,
        firstName: 'Vic',
        lastName: 'Tim',
        country: 'US',
        role: 'user',
        status: 'active',
        createdAt: now,
        lastSeenAt: now,
        emailVerifiedAt: now,
        totpEnabledAt: null,
      },
    ],
  };
}

// Mutable singleton the router reads/writes; reset() swaps in a fresh seed.
export let store: Store = seed();

export function reset(): void {
  store = seed();
}

/** List-row projection (the detail-only fields are dropped for the users list). */
export function userListRow(u: UserRow) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    country: u.country,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    lastSeenAt: u.lastSeenAt,
  };
}

const MOCK_API_ORIGIN = `http://localhost:${process.env.MOCK_API_PORT ?? 4099}`;

/**
 * Mirrors the real API's photo-URL contract exactly: an approved photo gets an
 * absolute public CDN URL (rendered directly, no proxy); anything else gets the
 * relative, parent-bound private route, which requires a Bearer header an
 * `<img>` tag can never send — the admin console must route it through the
 * same-origin proxy instead.
 */
export function productPhotoUrls(productId: string, photo: MockProductPhoto, variant: 'thumb' | 'display') {
  if (photo.moderationStatus === 'approved') {
    return `${MOCK_API_ORIGIN}/public-media/${photo.id}/${variant}`;
  }
  return `/v1/products/${productId}/photos/${photo.id}/${variant}`;
}

export function editPhotoUrls(editId: string, photo: MockEditPhoto, variant: 'thumb' | 'display') {
  if (photo.retained) {
    // Retained always sources an already-live, already-public photo.
    return `${MOCK_API_ORIGIN}/public-media/${photo.sourceProductPhotoId ?? photo.id}/${variant}`;
  }
  return `/v1/product-edits/${editId}/photos/${photo.id}/${variant}`;
}

/**
 * `productSchema`-shaped DTO — what the real `/v1/products/:id/photos/order`,
 * `/v1/products/:id/photos/:photoId` (DELETE), and revision-approve routes all
 * return (`toApiProduct`'s shape, not the admin-only projection).
 */
export function fullProductDto(p: ProductRow) {
  return productSchema.parse({
    id: p.id,
    barcode: p.barcode,
    qrPayload: p.qrPayload,
    name: p.name,
    description: p.description,
    brand: p.brand,
    category: p.category,
    imageUrl: p.imageUrl,
    defaultShelfLifeDays: null,
    source: p.source,
    sourceId: null,
    isCommunityEligible: p.isCommunityEligible,
    buyAgainCount: p.buyAgainCount,
    buyAgainOnSaleCount: p.buyAgainOnSaleCount,
    wontBuyCount: p.wontBuyCount,
    ratingCount: p.ratingCount,
    reviewCount: p.reviewCount,
    status: p.status,
    version: p.version,
    photos: p.photos
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({
        id: photo.id,
        position: photo.position,
        thumbnailUrl: productPhotoUrls(p.id, photo, 'thumb'),
        displayUrl: productPhotoUrls(p.id, photo, 'display'),
      })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  });
}

/**
 * `productWithReviewsSchema`-shaped DTO — what the real, single-product
 * `GET /v1/products/:id` route actually returns (`fullProductDto` plus
 * `topReviews`, always `[]` for M2's not-yet-implemented top-reviews feature,
 * matching the real route's own `topReviews: []` placeholder).
 */
export function fullProductWithReviewsDto(p: ProductRow) {
  return productWithReviewsSchema.parse({ ...fullProductDto(p), topReviews: [] });
}

export function userDetail(u: UserRow) {
  return {
    ...userListRow(u),
    emailVerifiedAt: u.emailVerifiedAt,
    totpEnabledAt: u.totpEnabledAt,
    recordCount: 0,
    reviewCount: 0,
    openReportsAgainst: 0,
    sessions: [] as unknown[],
  };
}
