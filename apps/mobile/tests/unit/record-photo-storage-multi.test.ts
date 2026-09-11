import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  saveRecordLocalPhotos,
  getRecordLocalPhotos,
  removeRecordLocalPhotos,
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
});
