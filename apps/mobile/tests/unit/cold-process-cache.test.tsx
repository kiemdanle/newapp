import AsyncStorage from '@react-native-async-storage/async-storage';
import { createQueryClient, clearQueryClient } from '../../src/api/query-client';
import { imageDiskCache } from '../../src/cache/image-disk-cache';
import { clearProductMemoryCache, hydrateProductCache } from '../../src/api/products';
import { clearAllLocalUserData } from '../../src/auth/session-store';
import type { ProductWithReviews } from '@expyrico/shared';

describe('Cold-Process Cache Hydration & Remount', () => {
  beforeEach(async () => {
    await imageDiskCache.purgeAll();
    await AsyncStorage.clear();
    clearProductMemoryCache();
  });

  afterEach(() => {
    clearQueryClient();
  });

  it('L1 clear + L2 preload: imageDiskCache.hydrate warms L1 synchronously for cold remount', async () => {
    const key = 'public::https://cdn.example.com/cold-apple.webp';
    const localUri = 'data:image/webp;base64,cold-bytes-12345';
    // 1. Seed image in L2
    await imageDiskCache.set(key, {
      uri: 'https://cdn.example.com/cold-apple.webp',
      localUri,
      etag: '"cold-etag-1"',
      isPrivate: false,
    });

    // 2. Clear L1 memory to simulate cold process restart
    imageDiskCache.clearL1();
    expect(imageDiskCache.getSync(key)).toBeNull();

    // 3. Perform cold boot hydration
    await imageDiskCache.hydrate();

    // 4. L1 must now be warm synchronously (Frame 0 hit, zero network, zero spinner)
    const warmEntry = imageDiskCache.getSync(key);
    expect(warmEntry).toBeTruthy();
    expect(warmEntry?.localUri).toBe(localUri);
    expect(warmEntry?.etag).toBe('"cold-etag-1"');
  });
  it('deferred-hydration: large payloads (>32KB) deferred from boot hydration resolve from L2 without premature network fetch or timeout', async () => {
    const largeUri = 'https://cdn.example.com/large-photo.webp';
    const key = `public::${largeUri}`;
    const largePayload = 'data:image/webp;base64,' + 'X'.repeat(45 * 1024);

    // 1. Seed >32KB payload into L2
    await imageDiskCache.set(key, {
      uri: largeUri,
      localUri: largePayload,
      etag: '"etag-large-1"',
      isPrivate: false,
      byteSize: largePayload.length,
    });

    // 2. Clear L1 to simulate cold restart
    imageDiskCache.clearL1();
    // 3. Boot hydration runs
    await imageDiskCache.hydrate();

    // 4. Large payload (>32KB) is intentionally deferred from L1 sync memory to keep boot lightweight
    expect(imageDiskCache.getSync(key)).toBeNull();
    // 5. Asynchronous L2 get() resolves the deferred payload cleanly from AsyncStorage
    const asyncEntry = await imageDiskCache.get(key);
    expect(asyncEntry).toBeTruthy();
    expect(asyncEntry?.localUri).toBe(largePayload);
  });
  it('Product Cache: hydrateProductCache populates both memory map and TanStack QueryClient on cold start', async () => {
    const queryClient = createQueryClient();
    const productId = 'prod-cold-999';
    const mockProduct: ProductWithReviews = {
      id: productId,
      name: 'Cold Pressed Juice',
      brand: 'Organic Farm',
      category: 'Beverages',
      description: null,
      status: 'active',
      imageUrl: 'https://cdn.example.com/juice.webp',
      barcode: '999888777',
      qrPayload: null,
      defaultShelfLifeDays: 7,
      source: 'user',
      sourceId: null,
      isCommunityEligible: true,
      buyAgainCount: 0,
      buyAgainOnSaleCount: 0,
      wontBuyCount: 0,
      ratingCount: 0,
      reviewCount: 2,
      version: 1,
      photos: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      topReviews: [],
    };

    // 1. Seed AsyncStorage directly as if saved from previous session
    await AsyncStorage.setItem(
      '@expyrico_product_cache_v1',
      JSON.stringify({ [productId]: mockProduct }),
    );

    // Verify initial cold state
    expect(queryClient.getQueryData(['products', productId])).toBeUndefined();

    // 2. Run cold boot product cache hydration with the app queryClient
    await hydrateProductCache(queryClient);

    // 3. TanStack Query cache must be populated immediately without waiting for network fetch
    const cachedInQuery = queryClient.getQueryData<ProductWithReviews>(['products', productId]);
    expect(cachedInQuery).toEqual(mockProduct);
    queryClient.clear();
  });

  it('Privacy & Account Switch: drafts are never persisted or hydrated, and clearAllLocalUserData purges product cache', async () => {
    const queryClient = createQueryClient();
    const draftId = 'prod-draft-123';
    const activeId = 'prod-active-456';
    const draftProduct: ProductWithReviews = {
      id: draftId,
      name: 'Private Draft Salad',
      brand: 'Secret Brand',
      category: 'Produce',
      description: null,
      status: 'draft',
      imageUrl: 'https://cdn.example.com/draft.webp',
      barcode: null,
      qrPayload: null,
      defaultShelfLifeDays: 3,
      source: 'user',
      sourceId: null,
      isCommunityEligible: false,
      buyAgainCount: 0,
      buyAgainOnSaleCount: 0,
      wontBuyCount: 0,
      ratingCount: 0,
      reviewCount: 0,
      version: 1,
      photos: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      topReviews: [],
    };

    const activeProduct: ProductWithReviews = {
      ...draftProduct,
      id: activeId,
      name: 'Public Active Salad',
      status: 'active',
    };

    // 1. Attempt to seed both active and draft into disk storage
    await AsyncStorage.setItem(
      '@expyrico_product_cache_v1',
      JSON.stringify({ [draftId]: draftProduct, [activeId]: activeProduct }),
    );

    // 2. Hydrate product cache
    await hydrateProductCache(queryClient);

    // 3. Invariant: Active product is hydrated; private draft MUST be rejected and never hydrated
    expect(queryClient.getQueryData(['products', activeId])).toEqual(activeProduct);
    expect(queryClient.getQueryData(['products', draftId])).toBeUndefined();

    // 4. User logs out / switches accounts: clearAllLocalUserData runs
    await clearAllLocalUserData('user-1');

    // 5. Invariant: Persistent storage and in-memory cache are completely purged
    const storedAfterLogout = await AsyncStorage.getItem('@expyrico_product_cache_v1');
    expect(storedAfterLogout).toBeNull();
    expect(queryClient.getQueryData(['products', activeId])).toBeUndefined();
  });
});
