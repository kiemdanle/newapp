import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pantry.recordPhotoAttachments.v1';

type AttachmentsMap = Record<string, string[]>;

let storageEpoch = 0;
let storageQueue: Promise<unknown> = Promise.resolve();
let memoryCache: AttachmentsMap = {};
let loadPromise: Promise<AttachmentsMap> | null = null;
let initialized = false;
type StorageListener = () => void;
const listeners = new Set<StorageListener>();

export function subscribeRecordPhotoStorage(listener: StorageListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // subscriber error ignored
    }
  }
}

function enqueueStorageOp<T>(op: (epoch: number) => Promise<T>): Promise<T> {
  const currentEpoch = storageEpoch;
  const next = storageQueue.then(async () => {
    if (currentEpoch !== storageEpoch) {
      return undefined as unknown as T;
    }
    return op(currentEpoch);
  });
  storageQueue = next.then(() => {}, () => {});
  return next;
}

async function loadAttachments(): Promise<AttachmentsMap> {
  if (initialized) return memoryCache;
  if (loadPromise) return loadPromise;
  const currentEpoch = storageEpoch;
  const currentPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (currentEpoch === storageEpoch) {
        memoryCache = raw ? (JSON.parse(raw) as AttachmentsMap) : {};
        initialized = true;
        notifyListeners();
      }
    } catch {
      if (currentEpoch === storageEpoch) {
        memoryCache = {};
        initialized = true;
        notifyListeners();
      }
    } finally {
      if (currentEpoch === storageEpoch) {
        loadPromise = null;
      }
    }
    return memoryCache;
  })();
  loadPromise = currentPromise;
  return loadPromise;
}

export async function getRecordLocalPhotos(clientId: string): Promise<string[]> {
  const map = await loadAttachments();
  return map[clientId] ?? [];
}
export function hasRecordLocalPhotosSync(clientId: string): boolean {
  return clientId in memoryCache;
}

export function getRecordLocalPhotosSync(clientId: string): string[] | null {
  if (clientId in memoryCache) {
    return memoryCache[clientId] ?? [];
  }
  return null;
}

export async function saveRecordLocalPhotos(clientId: string, paths: string[]): Promise<void> {
  const sliced = (paths || []).slice(0, 20);
  memoryCache[clientId] = sliced;
  notifyListeners();
  return enqueueStorageOp(async (opEpoch) => {
    if (opEpoch !== storageEpoch) return;
    const map = await loadAttachments();
    if (opEpoch !== storageEpoch) return;
    map[clientId] = sliced;
    memoryCache = { ...map };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
    if (opEpoch !== storageEpoch) return;
    notifyListeners();
  });
}

export async function removeRecordLocalPhotos(clientId: string): Promise<void> {
  delete memoryCache[clientId];
  notifyListeners();
  return enqueueStorageOp(async (opEpoch) => {
    if (opEpoch !== storageEpoch) return;
    const map = await loadAttachments();
    if (opEpoch !== storageEpoch) return;
    delete map[clientId];
    memoryCache = { ...map };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
    if (opEpoch !== storageEpoch) return;
    notifyListeners();
  });
}

export async function clearAllRecordPhotoAttachments(): Promise<void> {
  storageEpoch++;
  loadPromise = null;
  memoryCache = {};
  initialized = true;
  return enqueueStorageOp(async (opEpoch) => {
    if (opEpoch !== storageEpoch) return;
    memoryCache = {};
    await AsyncStorage.removeItem(STORAGE_KEY);
    notifyListeners();
  });
}

export function useRecordPhotoStorage(clientId?: string | null): string[] {
  const [photos, setPhotos] = useState<string[]>(() =>
    clientId ? getRecordLocalPhotosSync(clientId) ?? [] : [],
  );

  useEffect(() => {
    if (!clientId) {
      setPhotos([]);
      return;
    }
    let active = true;
    void getRecordLocalPhotos(clientId).then((res) => {
      if (active) setPhotos(res);
    });
    return () => {
      active = false;
    };
  }, [clientId]);

  return photos;
}

// Eagerly initialize hydration from AsyncStorage on module load
void loadAttachments();
