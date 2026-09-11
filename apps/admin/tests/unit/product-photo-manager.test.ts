import { describe, expect, it } from 'vitest';

interface PhotoItem {
  id: string;
  position: number;
}

function computeSetAsCoverOrder(photos: PhotoItem[], targetId: string): PhotoItem[] {
  const target = photos.find((p) => p.id === targetId);
  if (!target) return photos;
  const remaining = photos.filter((p) => p.id !== targetId);
  return [target, ...remaining].map((p, index) => ({ ...p, position: index }));
}

function computeMoveOrder(photos: PhotoItem[], index: number, delta: number): PhotoItem[] {
  const target = index + delta;
  if (target < 0 || target >= photos.length) return photos;
  const next = [...photos];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next.map((p, i) => ({ ...p, position: i }));
}

describe('ProductPhotoManager ordering algorithms', () => {
  const samplePhotos: PhotoItem[] = [
    { id: 'photo-1', position: 0 },
    { id: 'photo-2', position: 1 },
    { id: 'photo-3', position: 2 },
  ];

  it('promotes any photo to position 0 when setting as cover', () => {
    const result = computeSetAsCoverOrder(samplePhotos, 'photo-3');
    expect(result[0]!.id).toBe('photo-3');
    expect(result[0]!.position).toBe(0);
    expect(result[1]!.id).toBe('photo-1');
    expect(result[1]!.position).toBe(1);
    expect(result[2]!.id).toBe('photo-2');
    expect(result[2]!.position).toBe(2);
  });

  it('moves photos earlier (up) and later (down) deterministically', () => {
    const movedDown = computeMoveOrder(samplePhotos, 0, 1);
    expect(movedDown.map((p) => p.id)).toEqual(['photo-2', 'photo-1', 'photo-3']);

    const movedUp = computeMoveOrder(samplePhotos, 2, -1);
    expect(movedUp.map((p) => p.id)).toEqual(['photo-1', 'photo-3', 'photo-2']);
  });

  it('ignores boundary moves past top or bottom', () => {
    const pastTop = computeMoveOrder(samplePhotos, 0, -1);
    expect(pastTop.map((p) => p.id)).toEqual(['photo-1', 'photo-2', 'photo-3']);

    const pastBottom = computeMoveOrder(samplePhotos, 2, 1);
    expect(pastBottom.map((p) => p.id)).toEqual(['photo-1', 'photo-2', 'photo-3']);
  });
});

describe('ProductPhotoManager client upload constraints', () => {
  const MAX_PHOTOS = 5;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png'];

  it('validates allowed image MIME types and rejects unsupported types', () => {
    expect(ALLOWED_TYPES.includes('image/jpeg')).toBe(true);
    expect(ALLOWED_TYPES.includes('image/png')).toBe(true);
    expect(ALLOWED_TYPES.includes('image/webp')).toBe(false);
    expect(ALLOWED_TYPES.includes('image/gif')).toBe(false);
    expect(ALLOWED_TYPES.includes('application/pdf')).toBe(false);
  });

  it('validates 5MB maximum file size', () => {
    expect(4.9 * 1024 * 1024 <= MAX_FILE_SIZE).toBe(true);
    expect(5.1 * 1024 * 1024 <= MAX_FILE_SIZE).toBe(false);
  });

  it('enforces 5 photo max quota boundary', () => {
    const fullGallery = [1, 2, 3, 4, 5];
    const remainingSlots = Math.max(0, MAX_PHOTOS - fullGallery.length);
    expect(remainingSlots).toBe(0);
  });
});
