import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveRecordLocalPhotos,
  getRecordLocalPhotos,
  getRecordLocalPhotosSync,
  removeRecordLocalPhotos,
  clearAllRecordPhotoAttachments,
} from '../../src/features/records/record-photo-storage';

describe('record-photo-storage multi-photo persistence (> 5 photos)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('saves and reloads 6 photos without truncating down to 5', async () => {
    const clientId = 'rec-6-photos';
    const photos = Array.from({ length: 6 }, (_, i) => `/path/photo-${i}.jpg`);

    await saveRecordLocalPhotos(clientId, photos);
    const loaded = await getRecordLocalPhotos(clientId);

    expect(loaded).toHaveLength(6);
    expect(loaded).toEqual(photos);
  });

  it('saves and reloads 12 photos without truncation', async () => {
    const clientId = 'rec-12-photos';
    const photos = Array.from({ length: 12 }, (_, i) => `/path/photo-${i}.jpg`);

    await saveRecordLocalPhotos(clientId, photos);
    const loaded = await getRecordLocalPhotos(clientId);

    expect(loaded).toHaveLength(12);
    expect(loaded).toEqual(photos);
  });

  it('removes photos cleanly when requested', async () => {
    const clientId = 'rec-delete';
    const photos = ['/path/1.jpg', '/path/2.jpg', '/path/3.jpg'];

    await saveRecordLocalPhotos(clientId, photos);
    expect(await getRecordLocalPhotos(clientId)).toHaveLength(3);

    await removeRecordLocalPhotos(clientId);
    expect(await getRecordLocalPhotos(clientId)).toHaveLength(0);
  });
  it('deferred AsyncStorage save/clear interleaving: in-flight setItem resolves after clear, but removeItem executes and keeps storage clean', async () => {
    let resolveStarted!: () => void;
    const startedPromise = new Promise<void>((r) => { resolveStarted = r; });
    let openGate!: () => void;
    const gatePromise = new Promise<void>((r) => { openGate = r; });
    const origSetItem = (AsyncStorage.setItem as jest.Mock).getMockImplementation();
    (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key: string, value: string) => {
      if (key === 'pantry.recordPhotoAttachments.v1') {
        resolveStarted();
        await gatePromise;
      }
      if (origSetItem) {
        return origSetItem(key, value);
      }
    });

    // 1. Initiate save — enters saveRecordLocalPhotos and signals when setItem is entered
    const savePromise = saveRecordLocalPhotos('rec-deferred-save', ['/path/photo1.jpg']);

    // Await deterministic signal that setItem was reached and suspended
    await startedPromise;

    // 2. While setItem is suspended, logout/clear occurs
    const clearPromise = clearAllRecordPhotoAttachments();

    // 3. Now release the suspended setItem
    openGate();

    // 4. Await both operations
    await Promise.all([savePromise, clearPromise]);

    // Verify storage is completely clean: clear executed and purged attachments
    const stored = await AsyncStorage.getItem('pantry.recordPhotoAttachments.v1');
    expect(stored).toBeNull();
    if (origSetItem) {
      (AsyncStorage.setItem as jest.Mock).mockImplementation(origSetItem);
    } else {
      (AsyncStorage.setItem as jest.Mock).mockReset();
    }
  });
});
