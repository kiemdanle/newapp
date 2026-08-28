import AsyncStorage from '@react-native-async-storage/async-storage';
import { imageDiskCache, ImageDiskCache } from '../image-disk-cache';
import { computeCacheKey } from '../image-cache-types';

describe('ImageDiskCache (StorageCore)', () => {
  beforeEach(async () => {
    await imageDiskCache.purgeAll();
  });

  it('provides singleton instance', () => {
    const instance1 = ImageDiskCache.getInstance();
    const instance2 = ImageDiskCache.getInstance();
    expect(instance1).toBe(instance2);
    expect(instance1).toBe(imageDiskCache);
  });

  it('stores and retrieves cache entries synchronously via L1 and asynchronously via L2', async () => {
    const key = 'public::https://cdn.example.com/p1.webp';
    const entry = {
      uri: 'https://cdn.example.com/p1.webp',
      localUri: 'data:image/webp;base64,samplebytes',
      etag: '"etag-123"',
      lastModified: 'Wed, 27 Aug 2026 00:00:00 GMT',
      timestamp: Date.now(),
      byteSize: 100,
      isPrivate: false,
    };

    // Initially not in cache
    expect(imageDiskCache.getSync(key)).toBeNull();
    expect(await imageDiskCache.get(key)).toBeNull();

    // Store in cache
    const saved = await imageDiskCache.set(key, entry);
    expect(saved).toBeTruthy();
    expect(saved?.key).toBe(key);
    expect(saved?.etag).toBe('"etag-123"');

    // Instant Frame-0 synchronous retrieval from L1
    const syncHit = imageDiskCache.getSync(key);
    expect(syncHit).toBeTruthy();
    expect(syncHit?.localUri).toBe('data:image/webp;base64,samplebytes');
    expect(syncHit?.etag).toBe('"etag-123"');

    // Asynchronous retrieval
    const asyncHit = await imageDiskCache.get(key);
    expect(asyncHit).toBeTruthy();
    expect(asyncHit?.localUri).toBe('data:image/webp;base64,samplebytes');
  });

  it('enforces decoupled storage for large data payloads to protect Android CursorWindow (<1KB metadata rows)', async () => {
    const key = 'public::https://cdn.example.com/large.webp';
    // 5 KB base64 string
    const largeData = 'data:image/webp;base64,' + 'A'.repeat(5000);

    await imageDiskCache.set(key, {
      uri: 'https://cdn.example.com/large.webp',
      localUri: largeData,
      etag: '"large-etag"',
      lastModified: null,
      timestamp: Date.now(),
      byteSize: largeData.length,
      isPrivate: false,
    });

    // Check raw AsyncStorage metadata ledger
    const metaRaw = await AsyncStorage.getItem(`@img_meta:${key}`);
    expect(metaRaw).toBeTruthy();
    expect(metaRaw!.length).toBeLessThan(1000); // Strict CursorWindow guard: metadata <1KB

    const parsedMeta = JSON.parse(metaRaw!);
    expect(parsedMeta.localUri).toBe(''); // Decoupled payload stripped from metadata row

    // Decoupled payload stored in data ledger
    const dataRaw = await AsyncStorage.getItem(`@img_data:${key}`);
    expect(dataRaw).toBe(largeData);

    // Clear L1 to test cold L2 decoupled rehydration
    imageDiskCache.clearL1();
    expect(imageDiskCache.getSync(key)).toBeNull();

    const rehydrated = await imageDiskCache.get(key);
    expect(rehydrated).toBeTruthy();
    expect(rehydrated?.localUri).toBe(largeData);
  });

  it('updates metadata timestamps on 304 without touching data payload', async () => {
    const key = 'public::https://cdn.example.com/item.webp';
    const initialTime = 1000000;

    await imageDiskCache.set(key, {
      uri: 'https://cdn.example.com/item.webp',
      localUri: 'data:image/webp;base64,original',
      etag: '"v1"',
      lastModified: null,
      timestamp: initialTime,
      byteSize: 50,
      isPrivate: false,
    });

    const newTime = 2000000;
    await imageDiskCache.updateMetadata(key, {
      etag: '"v2"',
      timestamp: newTime,
    });

    const updated = await imageDiskCache.get(key);
    expect(updated?.etag).toBe('"v2"');
    expect(updated?.timestamp).toBe(newTime);
    expect(updated?.localUri).toBe('data:image/webp;base64,original');
  });

  it('purges user private photos on sign-out while preserving public catalog images', async () => {
    const userAKey = 'private::user-123::draft:p1::photo1::thumb';
    const userBKey = 'private::user-456::draft:p2::photo2::thumb';
    const publicKey = 'public::https://cdn.example.com/public-catalog.webp';

    await imageDiskCache.set(userAKey, {
      uri: '/products/p1/photos/photo1/thumb',
      localUri: 'data:image/webp;base64,userA',
      isPrivate: true,
      userId: 'user-123',
      timestamp: Date.now(),
      byteSize: 100,
    });

    await imageDiskCache.set(userBKey, {
      uri: '/products/p2/photos/photo2/thumb',
      localUri: 'data:image/webp;base64,userB',
      isPrivate: true,
      userId: 'user-456',
      timestamp: Date.now(),
      byteSize: 100,
    });

    await imageDiskCache.set(publicKey, {
      uri: 'https://cdn.example.com/public-catalog.webp',
      localUri: 'data:image/webp;base64,pub',
      isPrivate: false,
      timestamp: Date.now(),
      byteSize: 100,
    });

    // User A signs out
    await imageDiskCache.purgeUserPrivate('user-123');

    // User A's private entries are purged
    expect(imageDiskCache.getSync(userAKey)).toBeNull();
    expect(await imageDiskCache.get(userAKey)).toBeNull();

    // User B's entries and public images remain intact
    expect(imageDiskCache.getSync(userBKey)).toBeTruthy();
    expect(imageDiskCache.getSync(publicKey)).toBeTruthy();
  });

  it('purges specific draft/edit targets via purgeTarget', async () => {
    const p1Photo1 = 'private::user-1::draft:p1::photo-1::display';
    const p1Photo2 = 'private::user-1::draft:p1::photo-2::thumb';
    const p2Photo1 = 'private::user-1::draft:p2::photo-1::display';

    await imageDiskCache.set(p1Photo1, {
      uri: '/p1/1',
      localUri: 'data:image/jpeg;base64,p1-1',
      isPrivate: true,
      userId: 'user-1',
      timestamp: Date.now(),
      byteSize: 50,
    });
    await imageDiskCache.set(p1Photo2, {
      uri: '/p1/2',
      localUri: 'data:image/jpeg;base64,p1-2',
      isPrivate: true,
      userId: 'user-1',
      timestamp: Date.now(),
      byteSize: 50,
    });
    await imageDiskCache.set(p2Photo1, {
      uri: '/p2/1',
      localUri: 'data:image/jpeg;base64,p2-1',
      isPrivate: true,
      userId: 'user-1',
      timestamp: Date.now(),
      byteSize: 50,
    });

    await imageDiskCache.purgeTarget('draft:p1');

    expect(imageDiskCache.getSync(p1Photo1)).toBeNull();
    expect(await imageDiskCache.get(p1Photo1)).toBeNull();
    expect(imageDiskCache.getSync(p1Photo2)).toBeNull();

    // p2 is unaffected
    expect(imageDiskCache.getSync(p2Photo1)).toBeTruthy();
  });

  it('enforces LRU eviction budget when total size exceeds limit', async () => {
    // Set budget: 300 bytes
    const maxBudget = 300;

    await imageDiskCache.set('item1', {
      uri: 'http://1',
      localUri: 'data:1',
      timestamp: 100,
      byteSize: 150,
      isPrivate: false,
    });

    await imageDiskCache.set('item2', {
      uri: 'http://2',
      localUri: 'data:2',
      timestamp: 200,
      byteSize: 150,
      isPrivate: false,
    });

    // Access item1 to make it more recently used than item2
    imageDiskCache.getSync('item1');

    // Add item3: 150 bytes (Total = 450 > 300)
    await imageDiskCache.set('item3', {
      uri: 'http://3',
      localUri: 'data:3',
      timestamp: 300,
      byteSize: 150,
      isPrivate: false,
    });

    await imageDiskCache.pruneLru(maxBudget);

    // Least-recently-used entry (item2) must be evicted first
    expect(imageDiskCache.getSync('item2')).toBeNull();
    expect(imageDiskCache.getSync('item1')).toBeTruthy();
    expect(imageDiskCache.getSync('item3')).toBeTruthy();
  });

  it('hydrates L1 memory index from AsyncStorage on startup', async () => {
    const key = 'public::https://cdn.example.com/boot.webp';
    await AsyncStorage.setItem(
      `@img_meta:${key}`,
      JSON.stringify({
        key,
        uri: 'https://cdn.example.com/boot.webp',
        localUri: 'data:image/webp;base64,bootdata',
        timestamp: Date.now(),
        byteSize: 50,
        isPrivate: false,
      }),
    );

    imageDiskCache.clearL1();
    expect(imageDiskCache.getSync(key)).toBeNull();

    await imageDiskCache.hydrate();

    // After hydration, available synchronously in L1
    expect(imageDiskCache.getSync(key)).toBeTruthy();
    expect(imageDiskCache.getSync(key)?.localUri).toBe('data:image/webp;base64,bootdata');
  });

  it('cleans up previously chunked storage keys when overwriting with a smaller inline payload', async () => {
    const key = 'public::https://cdn.example.com/oversized.webp';
    // 600 KB payload -> stored across 3 chunks (>256KB each)
    const largePayload = 'data:image/webp;base64,' + 'B'.repeat(600 * 1024);

    await imageDiskCache.set(key, {
      uri: 'https://cdn.example.com/oversized.webp',
      localUri: largePayload,
      timestamp: Date.now(),
      isPrivate: false,
    });

    // Confirm chunks were created
    expect(await AsyncStorage.getItem(`@img_chunk:${key}:0`)).toBeTruthy();
    expect(await AsyncStorage.getItem(`@img_chunk:${key}:1`)).toBeTruthy();

    // Overwrite with small 100B inline payload
    const smallPayload = 'data:image/webp;base64,small';
    await imageDiskCache.set(key, {
      uri: 'https://cdn.example.com/oversized.webp',
      localUri: smallPayload,
      timestamp: Date.now(),
      isPrivate: false,
    });

    // Prior chunks must be completely cleaned up from storage
    expect(await AsyncStorage.getItem(`@img_chunk:${key}:0`)).toBeNull();
    expect(await AsyncStorage.getItem(`@img_chunk:${key}:1`)).toBeNull();

    const retrieved = await imageDiskCache.get(key);
    expect(retrieved?.localUri).toBe(smallPayload);
  });

  it('decouples oversized signed CDN URIs (>192 chars) into @img_uri:* so @img_meta:* remains strictly <600B', async () => {
    const longUri =
      'https://cdn.example.com/photos/item-12345.webp?token=' +
      'X'.repeat(800) +
      '&signature=' +
      'Y'.repeat(400);
    const key = computeCacheKey({ uri: longUri })!;
    expect(key.length).toBeLessThan(128); // Bounded key length

    await imageDiskCache.set(key, {
      uri: longUri,
      localUri: 'data:image/webp;base64,sample',
      timestamp: Date.now(),
      isPrivate: false,
    });

    // Metadata row in AsyncStorage remains strictly <600B
    const metaRaw = await AsyncStorage.getItem(`@img_meta:${key}`);
    expect(metaRaw).toBeTruthy();
    expect(metaRaw!.length).toBeLessThan(600);

    // Full exact URI stored in decoupled URI ledger
    const uriRaw = await AsyncStorage.getItem(`@img_uri:${key}`);
    expect(uriRaw).toBe(longUri);

    // Clear L1 to test cold L2 decoupled rehydration
    imageDiskCache.clearL1();
    const retrieved = await imageDiskCache.get(key);
    expect(retrieved?.uri).toBe(longUri);
  });
});
