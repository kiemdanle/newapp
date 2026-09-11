import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'pantry.recordPhotoAttachments.v1';

type AttachmentsMap = Record<string, string[]>;

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

async function loadAttachments(): Promise<AttachmentsMap> {
  if (initialized) return memoryCache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      memoryCache = raw ? (JSON.parse(raw) as AttachmentsMap) : {};
    } catch {
      memoryCache = {};
    } finally {
      initialized = true;
      loadPromise = null;
      notifyListeners();
    }
    return memoryCache;
  })();
  return loadPromise;
}

export async function getRecordLocalPhotos(clientId: string): Promise<string[]> {
  const map = await loadAttachments();
  return map[clientId] ?? [];
}

export function getRecordLocalPhotosSync(clientId: string): string[] {
  return memoryCache[clientId] ?? [];
}

export async function saveRecordLocalPhotos(clientId: string, paths: string[]): Promise<void> {
  const map = await loadAttachments();
  if (!paths || paths.length === 0) {
    delete map[clientId];
  } else {
    map[clientId] = paths.slice(0, 20);
  }
  memoryCache = { ...map };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
  notifyListeners();
}

export async function removeRecordLocalPhotos(clientId: string): Promise<void> {
  const map = await loadAttachments();
  delete map[clientId];
  memoryCache = { ...map };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memoryCache));
  notifyListeners();
}

export function useRecordLocalPhotos(clientId?: string | null): string[] {
  const [photos, setPhotos] = useState<string[]>(() =>
    clientId ? getRecordLocalPhotosSync(clientId) : [],
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
