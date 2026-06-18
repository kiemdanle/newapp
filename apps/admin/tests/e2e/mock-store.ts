// apps/admin/tests/e2e/mock-store.ts
// In-memory data store for the admin E2E mock API. Seeded with deterministic
// UUID fixtures so specs can target known ids. `POST /v1/dev/reset` re-seeds it
// (see mock-api.ts) so each spec starts from a clean, known state even though
// Playwright reuses one mock-server process across tests.
//
// Every shape here matches the @expyrico/shared admin Zod schemas that
// serverAdminApi parses — keep them in sync or the admin pages 500 on parse.

const now = new Date('2026-06-01T00:00:00.000Z').toISOString();

// Stable fixture ids (valid v4-shaped UUIDs) referenced by the specs.
export const FIXTURE = {
  reportId: 'aaaaaaaa-0000-4000-8000-000000000001',
  reviewTargetId: 'aaaaaaaa-0000-4000-8000-000000000002',
  reporterId: 'aaaaaaaa-0000-4000-8000-000000000003',
  winnerProductId: 'bbbbbbbb-0000-4000-8000-000000000001',
  loserProductId: 'bbbbbbbb-0000-4000-8000-000000000002',
  victimUserId: 'cccccccc-0000-4000-8000-000000000001',
} as const;

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

export interface ProductRow {
  id: string;
  barcode: string | null;
  qrPayload: string | null;
  name: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  source: 'off' | 'upcitemdb' | 'user';
  status: 'active' | 'pending' | 'merged_into';
  isCommunityEligible: boolean;
  buyAgainCount: number;
  buyAgainOnSaleCount: number;
  wontBuyCount: number;
  ratingCount: number;
  reviewCount: number;
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
  users: UserRow[];
}

function product(over: Partial<ProductRow> & Pick<ProductRow, 'id' | 'name'>): ProductRow {
  return {
    barcode: null,
    qrPayload: null,
    brand: null,
    category: null,
    imageUrl: null,
    source: 'user',
    status: 'active',
    isCommunityEligible: false,
    buyAgainCount: 0,
    buyAgainOnSaleCount: 0,
    wontBuyCount: 0,
    ratingCount: 0,
    reviewCount: 0,
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
