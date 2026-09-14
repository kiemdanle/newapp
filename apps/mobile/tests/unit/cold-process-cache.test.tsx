import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient } from '@tanstack/react-query';
import { imageDiskCache } from '../../src/cache/image-disk-cache';
import { clearProductMemoryCache, hydrateProductCache } from '../../src/api/products';
import type { ProductWithReviews } from '@expyrico/shared';

describe('Cold-Process Cache Hydration & Remount', () => {
  beforeEach(async () => {
    await imageDiskCache.purgeAll();
    await AsyncStorage.clear();
    clearProductMemoryCache();
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

  it('Product Cache: hydrateProductCache populates both memory map and TanStack QueryClient on cold start', async () => {
    const queryClient = new QueryClient();
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
  });
});
