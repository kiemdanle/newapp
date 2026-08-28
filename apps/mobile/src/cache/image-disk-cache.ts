import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_CACHE_MAX_BYTES,
  type CacheMetadata,
} from './image-cache-types';

const META_PREFIX = '@img_meta:';
const DATA_PREFIX = '@img_data:';
const CHUNK_PREFIX = '@img_chunk:';
const URI_PREFIX = '@img_uri:';
const CHUNK_SIZE = 256 * 1024; // 256 KB chunk size — strictly <2MB Android CursorWindow limit
const MAX_INLINE_URI_LENGTH = 192; // URIs longer than this are decoupled to @img_uri:* to guarantee @img_meta:* strictly <650B

export interface StoredCacheMetadata extends CacheMetadata {
  chunkCount?: number;
  userGeneration?: number;
  targetSubstr?: string;
  targetGeneration?: number;
}

/**
 * Bounds metadata field lengths and decouples large payloads/URIs to strictly guarantee
 * that every AsyncStorage metadata ledger record (@img_meta:*) remains <250B, safely avoiding CursorWindow issues.
 */
function serializeMetadataLedgerRow(meta: StoredCacheMetadata): string {
  const isDataUri = meta.localUri.startsWith('data:');
  const metaOnly: StoredCacheMetadata = {
    key: meta.key,
    uri: meta.uri.length > MAX_INLINE_URI_LENGTH ? '' : meta.uri,
    localUri: isDataUri ? '' : meta.localUri,
    etag: meta.etag,
    lastModified: meta.lastModified,
    timestamp: meta.timestamp,
    lastAccessed: meta.lastAccessed,
    byteSize: meta.byteSize,
    isPrivate: meta.isPrivate,
    userId: meta.userId,
    userGeneration: meta.userGeneration,
    targetSubstr: meta.targetSubstr,
    targetGeneration: meta.targetGeneration,
    contentType: meta.contentType,
    chunkCount: meta.chunkCount,
  };
  return JSON.stringify(metaOnly);
}

function extractTargetSubstr(key: string): string | null {
  if (key.includes('::draft:')) {
    const match = key.match(/::(draft:[^:]+)::/);
    if (match && match[1]) return match[1];
  }
  if (key.includes('::edit:')) {
    const match = key.match(/::(edit:[^:]+)::/);
    if (match && match[1]) return match[1];
  }
  return null;
}

function extractUserId(key: string): string | null {
  if (key.startsWith('private::')) {
    const parts = key.split('::');
    if (parts.length >= 2 && parts[1]) return parts[1];
  }
  return null;
}

export class ImageDiskCache {
  private static instance: ImageDiskCache;
  private l1Cache = new Map<string, StoredCacheMetadata>();
  private userPurgeGenerations = new Map<string, number>();
  private targetPurgeGenerations = new Map<string, number>();
  private purgeListeners = new Set<(filter: string) => void>();

  public onPurge(listener: (filter: string) => void): () => void {
    this.purgeListeners.add(listener);
    return () => {
      this.purgeListeners.delete(listener);
    };
  }

  private notifyPurge(filter: string): void {
    for (const listener of this.purgeListeners) {
      try {
        listener(filter);
      } catch {
        // Safe listener execution
      }
    }
  }

  private hydrated = false;
  private hydratingPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): ImageDiskCache {
    if (!ImageDiskCache.instance) {
      ImageDiskCache.instance = new ImageDiskCache();
    }
    return ImageDiskCache.instance;
  }

  private isKeyPurged(key: string, meta?: StoredCacheMetadata): boolean {
    const userId = meta?.userId || extractUserId(key);
    if (userId) {
      const currentGen = this.userPurgeGenerations.get(userId) ?? 0;
      const metaGen = meta?.userGeneration ?? 0;
      if (metaGen < currentGen) {
        return true;
      }
    }

    const targetSubstr = meta?.targetSubstr || extractTargetSubstr(key);
    if (targetSubstr) {
      const currentGen = this.targetPurgeGenerations.get(targetSubstr) ?? 0;
      const metaGen = meta?.targetGeneration ?? 0;
      if (metaGen < currentGen) {
        return true;
      }
    }

    return false;
  }

  /**
   * Synchronous L1 in-memory lookup. Returns cached image data within <0.01ms (Frame 0).
   */
  public getSync(key: string): CacheMetadata | null {
    const memory = this.l1Cache.get(key);
    if (!memory) return null;
    if (this.isKeyPurged(key, memory)) {
      this.l1Cache.delete(key);
      return null;
    }
    if (!memory.localUri && memory.byteSize > 0) {
      return null;
    }
    memory.lastAccessed = Date.now();
    return memory;
  }

  /**
   * Asynchronous lookup. Checks L1 memory first, then hydrates from AsyncStorage if necessary.
   */
  public async get(key: string): Promise<CacheMetadata | null> {
    const memory = this.getSync(key);
    if (memory) return memory;

    try {
      let meta: StoredCacheMetadata | undefined = this.l1Cache.get(key);
      if (!meta) {
        const metaRaw = await AsyncStorage.getItem(`${META_PREFIX}${key}`);
        if (!metaRaw) return null;
        meta = JSON.parse(metaRaw) as StoredCacheMetadata;
      }

      if (this.isKeyPurged(key, meta)) {
        void this.remove(key);
        return null;
      }

      // Rehydrate decoupled URI if oversized
      if (!meta.uri) {
        const fullUri = await AsyncStorage.getItem(`${URI_PREFIX}${key}`);
        if (fullUri) {
          meta.uri = fullUri;
        }
      }

      if (!meta.localUri && meta.byteSize > 0) {
        if (meta.chunkCount && meta.chunkCount > 1) {
          // Re-assemble chunked payload (guaranteed <=256KB per row)
          const chunkKeys: string[] = [];
          for (let i = 0; i < meta.chunkCount; i++) {
            chunkKeys.push(`${CHUNK_PREFIX}${key}:${i}`);
          }
          const chunks = await Promise.all(
            chunkKeys.map((ck) => AsyncStorage.getItem(ck)),
          );
          if (chunks.every((c) => c !== null)) {
            meta.localUri = chunks.join('');
          }
        } else {
          const dataRaw = await AsyncStorage.getItem(`${DATA_PREFIX}${key}`);
          if (dataRaw) {
            meta.localUri = dataRaw;
          }
        }
      }

      if (meta.localUri) {
        meta.lastAccessed = Date.now();
        this.l1Cache.set(key, meta);
        return meta;
      }
      return null;
    } catch {
      // Corrupted metadata or failed parse — clean up key
      void this.remove(key);
      return null;
    }
  }

  /**
   * Stores an image in the cache with decoupled metadata & chunked payload storage.
   */
  public async set(
    key: string,
    entry: Omit<CacheMetadata, 'key' | 'byteSize' | 'timestamp'> & {
      byteSize?: number;
      timestamp?: number;
    },
  ): Promise<CacheMetadata | null> {
    const calculatedByteSize =
      entry.byteSize !== undefined && entry.byteSize > 0
        ? entry.byteSize
        : entry.localUri
          ? entry.localUri.length
          : 0;

    const userId = entry.userId || extractUserId(key);
    const targetSubstr = extractTargetSubstr(key) ?? undefined;
    const userGen = userId ? this.userPurgeGenerations.get(userId) ?? 0 : 0;
    const targetGen = targetSubstr
      ? this.targetPurgeGenerations.get(targetSubstr) ?? 0
      : 0;

    const metadata: StoredCacheMetadata = {
      key,
      uri: entry.uri,
      localUri: entry.localUri,
      etag: entry.etag ?? null,
      lastModified: entry.lastModified ?? null,
      timestamp: entry.timestamp ?? Date.now(),
      lastAccessed: entry.lastAccessed ?? (entry.timestamp ?? Date.now()),
      byteSize: calculatedByteSize,
      isPrivate: entry.isPrivate ?? false,
      userId,
      userGeneration: userGen,
      targetSubstr,
      targetGeneration: targetGen,
      contentType: entry.contentType,
    };

    if (this.isKeyPurged(key, metadata)) {
      return null;
    }

    const prevEntry = this.l1Cache.get(key);

    // Store in L1 memory index immediately
    this.l1Cache.set(key, metadata);

    try {
      const isDataUri = metadata.localUri.startsWith('data:');
      const isLargeChunked =
        isDataUri && metadata.localUri.length > CHUNK_SIZE;
      const isDecoupledSingle = isDataUri && !isLargeChunked;
      const isOversizedUri = metadata.uri.length > MAX_INLINE_URI_LENGTH;

      // Clean up previously stored representation if layout changed
      const staleKeysToClean: string[] = [];
      if (prevEntry) {
        if (prevEntry.chunkCount && prevEntry.chunkCount > 1) {
          if (!isLargeChunked) {
            for (let i = 0; i < prevEntry.chunkCount; i++) {
              staleKeysToClean.push(`${CHUNK_PREFIX}${key}:${i}`);
            }
          }
        }
        if (!isDecoupledSingle) {
          staleKeysToClean.push(`${DATA_PREFIX}${key}`);
        }
        if (!isOversizedUri && prevEntry.uri.length > MAX_INLINE_URI_LENGTH) {
          staleKeysToClean.push(`${URI_PREFIX}${key}`);
        }
      }

      const storageWrites: Array<Promise<unknown>> = [];

      // Save decoupled URI if oversized
      if (isOversizedUri) {
        storageWrites.push(
          AsyncStorage.setItem(`${URI_PREFIX}${key}`, metadata.uri),
        );
      }

      if (isLargeChunked) {
        // Chunk large payloads to guarantee no SQLite row ever reaches CursorWindow limit
        const chunks: Array<[string, string]> = [];
        let offset = 0;
        let chunkIndex = 0;

        while (offset < metadata.localUri.length) {
          const chunk = metadata.localUri.slice(offset, offset + CHUNK_SIZE);
          chunks.push([`${CHUNK_PREFIX}${key}:${chunkIndex}`, chunk]);
          offset += CHUNK_SIZE;
          chunkIndex++;
        }

        // If previous chunk count was larger, clean up excess trailing chunks
        if (prevEntry?.chunkCount && prevEntry.chunkCount > chunkIndex) {
          for (let i = chunkIndex; i < prevEntry.chunkCount; i++) {
            staleKeysToClean.push(`${CHUNK_PREFIX}${key}:${i}`);
          }
        }

        metadata.chunkCount = chunkIndex;

        storageWrites.push(
          AsyncStorage.setItem(
            `${META_PREFIX}${key}`,
            serializeMetadataLedgerRow(metadata),
          ),
          AsyncStorage.multiSet(chunks),
        );
      } else if (isDecoupledSingle) {
        // Decoupled single data row (<256KB)
        metadata.chunkCount = 1;
        storageWrites.push(
          AsyncStorage.setItem(
            `${META_PREFIX}${key}`,
            serializeMetadataLedgerRow(metadata),
          ),
          AsyncStorage.setItem(`${DATA_PREFIX}${key}`, metadata.localUri),
        );
      } else {
        storageWrites.push(
          AsyncStorage.setItem(
            `${META_PREFIX}${key}`,
            serializeMetadataLedgerRow(metadata),
          ),
        );
      }

      if (staleKeysToClean.length > 0) {
        storageWrites.push(AsyncStorage.multiRemove(staleKeysToClean));
      }

      await Promise.all(storageWrites);
    } catch {
      // Best-effort storage persistence
    }

    // If a purge occurred while async storage writes were in flight, roll back immediately
    if (this.isKeyPurged(key, metadata)) {
      this.l1Cache.delete(key);
      void this.remove(key);
      return null;
    }

    // Trigger LRU eviction check asynchronously
    void this.pruneLru();

    return metadata;
  }

  /**
   * Updates metadata (e.g. refreshed timestamp on 304 Not Modified) without re-writing binary data.
   */
  public async updateMetadata(
    key: string,
    patch: Partial<CacheMetadata>,
  ): Promise<void> {
    const existing = await this.get(key);
    if (!existing) return;

    const updated: StoredCacheMetadata = {
      ...existing,
      ...patch,
      key, // Immutable
      lastAccessed: Date.now(),
    };

    if (this.isKeyPurged(key, updated)) {
      this.l1Cache.delete(key);
      void this.remove(key);
      return;
    }

    this.l1Cache.set(key, updated);

    try {
      await AsyncStorage.setItem(
        `${META_PREFIX}${key}`,
        serializeMetadataLedgerRow(updated),
      );
    } catch {
      // Best-effort update
    }

    if (this.isKeyPurged(key, updated)) {
      this.l1Cache.delete(key);
      void this.remove(key);
    }
  }

  /**
   * Removes a specific cached image from L1 memory and persistent storage.
   */
  public async remove(key: string): Promise<void> {
    this.l1Cache.delete(key);
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const chunkPrefix = `${CHUNK_PREFIX}${key}:`;
      const keysToDelete = allKeys.filter(
        (k) =>
          k === `${META_PREFIX}${key}` ||
          k === `${DATA_PREFIX}${key}` ||
          k === `${URI_PREFIX}${key}` ||
          k.startsWith(chunkPrefix),
      );
      if (keysToDelete.length > 0) {
        await AsyncStorage.multiRemove(keysToDelete);
      }
    } catch {
      // Best effort
    }
  }

  /**
   * Purges entries matching a target identifier (e.g. `draft:p1` or `edit:e1`) across L1 and persistent storage.
   */
  public async purgeTarget(targetSubstr: string): Promise<void> {
    const current = this.targetPurgeGenerations.get(targetSubstr) ?? 0;
    this.targetPurgeGenerations.set(targetSubstr, current + 1);
    this.notifyPurge(targetSubstr);
    for (const [k] of this.l1Cache.entries()) {
      if (k.includes(`::${targetSubstr}::`) || k.includes(`/${targetSubstr}/`)) {
        this.l1Cache.delete(k);
      }
    }

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const toDelete: string[] = [];
      for (const sk of allKeys) {
        if (
          sk.startsWith(META_PREFIX) ||
          sk.startsWith(DATA_PREFIX) ||
          sk.startsWith(CHUNK_PREFIX) ||
          sk.startsWith(URI_PREFIX)
        ) {
          if (sk.includes(`::${targetSubstr}::`) || sk.includes(`/${targetSubstr}/`)) {
            toDelete.push(sk);
          }
        }
      }
      if (toDelete.length > 0) {
        await AsyncStorage.multiRemove(toDelete);
      }
    } catch {
      // Best effort
    }
  }

  /**
   * Purges all private draft and record photos for a given user on sign-out or user switch.
   */
  public async purgeUserPrivate(userId: string): Promise<void> {
    if (!userId) return;

    const current = this.userPurgeGenerations.get(userId) ?? 0;
    this.userPurgeGenerations.set(userId, current + 1);
    this.notifyPurge(userId);
    const userPrefix = `private::${userId}::`;
    // Purge from L1 cache
    for (const [k, meta] of this.l1Cache.entries()) {
      if (k.startsWith(userPrefix) || (meta.isPrivate && meta.userId === userId)) {
        this.l1Cache.delete(k);
      }
    }

    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const storageKeysToDelete: string[] = [];

      for (const storageKey of allKeys) {
        if (
          storageKey.startsWith(META_PREFIX) ||
          storageKey.startsWith(DATA_PREFIX) ||
          storageKey.startsWith(CHUNK_PREFIX) ||
          storageKey.startsWith(URI_PREFIX)
        ) {
          if (storageKey.includes(userPrefix) || storageKey.includes(`::${userId}::`)) {
            storageKeysToDelete.push(storageKey);
          }
        }
      }

      if (storageKeysToDelete.length > 0) {
        await AsyncStorage.multiRemove(storageKeysToDelete);
      }
    } catch {
      // Best effort
    }
  }

  /**
   * Completely purges the entire image cache (both public and private).
   */
  public async purgeAll(): Promise<void> {
    this.l1Cache.clear();
    this.userPurgeGenerations.clear();
    this.targetPurgeGenerations.clear();
    this.notifyPurge('*');
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const imgKeys = allKeys.filter(
        (k) =>
          k.startsWith(META_PREFIX) ||
          k.startsWith(DATA_PREFIX) ||
          k.startsWith(CHUNK_PREFIX) ||
          k.startsWith(URI_PREFIX),
      );
      if (imgKeys.length > 0) {
        await AsyncStorage.multiRemove(imgKeys);
      }
    } catch {
      // Best effort
    }
  }

  /**
   * Enforces LRU disk budget (default 100 MB). Evicts oldest unaccessed entries when exceeded.
   */
  public async pruneLru(maxBytes = DEFAULT_CACHE_MAX_BYTES): Promise<void> {
    try {
      let totalBytes = 0;
      const entries: CacheMetadata[] = [];

      for (const meta of this.l1Cache.values()) {
        totalBytes += meta.byteSize || 0;
        entries.push(meta);
      }

      if (totalBytes <= maxBytes) return;

      // Sort by lastAccessed / timestamp ascending (least recently used first)
      entries.sort(
        (a, b) =>
          (a.lastAccessed || a.timestamp) - (b.lastAccessed || b.timestamp),
      );

      for (const entry of entries) {
        if (totalBytes <= maxBytes) break;
        await this.remove(entry.key);
        totalBytes -= entry.byteSize || 0;
      }
    } catch {
      // Best effort
    }
  }

  /**
   * Hydrates the L1 memory index from AsyncStorage metadata records on app startup.
   */
  public async hydrate(): Promise<void> {
    if (this.hydrated) return;
    if (this.hydratingPromise) return this.hydratingPromise;

    this.hydratingPromise = (async () => {
      try {
        const allKeys = await AsyncStorage.getAllKeys();
        const metaKeys = allKeys.filter((k) => k.startsWith(META_PREFIX));
        if (metaKeys.length === 0) {
          this.hydrated = true;
          return;
        }

        const pairs = await AsyncStorage.multiGet(metaKeys);
        const smallPayloadsToHydrate: string[] = [];
        const smallMetaRefs: StoredCacheMetadata[] = [];

        for (const [storageKey, rawVal] of pairs) {
          if (!rawVal) continue;
          try {
            const meta = JSON.parse(rawVal) as StoredCacheMetadata;
            const key = storageKey.slice(META_PREFIX.length);
            if (!this.isKeyPurged(key, meta)) {
              this.l1Cache.set(key, meta);
              if (
                !meta.localUri &&
                meta.byteSize > 0 &&
                meta.byteSize <= 32 * 1024 &&
                (!meta.chunkCount || meta.chunkCount === 1)
              ) {
                smallPayloadsToHydrate.push(`${DATA_PREFIX}${key}`);
                smallMetaRefs.push(meta);
              }
            }
          } catch {
            // Drop invalid record
          }
        }

        // Hydrate small thumbnail payloads in bounded batches of 30 items
        if (smallPayloadsToHydrate.length > 0) {
          const BATCH_SIZE = 30;
          for (let i = 0; i < smallPayloadsToHydrate.length; i += BATCH_SIZE) {
            const batchKeys = smallPayloadsToHydrate.slice(i, i + BATCH_SIZE);
            const batchRefs = smallMetaRefs.slice(i, i + BATCH_SIZE);
            try {
              const dataPairs = await AsyncStorage.multiGet(batchKeys);
              const dataMap = new Map(dataPairs);
              for (let j = 0; j < batchKeys.length; j++) {
                const dataVal = dataMap.get(batchKeys[j]!);
                const metaRef = batchRefs[j];
                if (dataVal && metaRef) {
                  metaRef.localUri = dataVal;
                }
              }
            } catch {
              // Best-effort batch hydration
            }
          }
        }
        this.hydrated = true;
        void this.pruneLru();
      } catch {
        this.hydrated = true;
      } finally {
        this.hydratingPromise = null;
      }
    })();

    return this.hydratingPromise;
  }

  /**
   * Helper for tests to inspect current L1 cache size and entries.
   */
  public getL1Size(): number {
    return this.l1Cache.size;
  }

  /**
   * Helper for tests to clear L1 in-memory cache directly.
   */
  public clearL1(): void {
    this.l1Cache.clear();
    this.hydrated = false;
  }
}

export const imageDiskCache = ImageDiskCache.getInstance();
