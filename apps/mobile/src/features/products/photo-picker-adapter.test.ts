import ImagePicker from 'react-native-image-crop-picker';
import { takePhoto, choosePhotos, cleanupTemp, PhotoTooLargeError } from './photo-picker-adapter';

jest.mock('react-native-image-crop-picker', () => ({
  __esModule: true,
  default: {
    openCamera: jest.fn(),
    openPicker: jest.fn(),
    cleanSingle: jest.fn(),
  },
}));

const openCameraMock = ImagePicker.openCamera as jest.MockedFunction<typeof ImagePicker.openCamera>;
const openPickerMock = ImagePicker.openPicker as jest.MockedFunction<typeof ImagePicker.openPicker>;
const cleanSingleMock = ImagePicker.cleanSingle as jest.MockedFunction<typeof ImagePicker.cleanSingle>;

const image = (overrides: Partial<{ path: string; width: number; height: number; mime: string; size: number }> = {}) => ({
  path: '/tmp/photo.jpg',
  width: 1600,
  height: 1200,
  mime: 'image/jpeg',
  size: 500_000,
  ...overrides,
});

describe('takePhoto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the picked photo with forced JPEG/compression options set', async () => {
    openCameraMock.mockResolvedValue(image() as never);

    const result = await takePhoto();

    expect(result).toEqual({ path: '/tmp/photo.jpg', width: 1600, height: 1200, mime: 'image/jpeg', size: 500_000 });
    expect(openCameraMock).toHaveBeenCalledWith(
      expect.objectContaining({ forceJpg: true, compressImageMaxWidth: 1600, compressImageMaxHeight: 1600, compressImageQuality: 0.82 }),
    );
  });

  it('resolves null on user cancellation instead of throwing', async () => {
    openCameraMock.mockRejectedValue({ code: 'E_PICKER_CANCELLED' });

    await expect(takePhoto()).resolves.toBeNull();
  });

  it('rethrows non-cancellation errors', async () => {
    openCameraMock.mockRejectedValue(new Error('camera unavailable'));

    await expect(takePhoto()).rejects.toThrow('camera unavailable');
  });

  it('throws PhotoTooLargeError when the compressed result is still over 10 MB', async () => {
    openCameraMock.mockResolvedValue(image({ size: 11 * 1024 * 1024 }) as never);

    await expect(takePhoto()).rejects.toBeInstanceOf(PhotoTooLargeError);
  });

  it('does not enlarge an already-small image (compress options are max-only)', async () => {
    openCameraMock.mockResolvedValue(image({ width: 400, height: 300, size: 50_000 }) as never);

    const result = await takePhoto();

    expect(result).toEqual(expect.objectContaining({ width: 400, height: 300 }));
  });
});

describe('choosePhotos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('requests multiple selection capped at the remaining slot count with cropping disabled', async () => {
    openPickerMock.mockResolvedValue([image({ path: '/tmp/a.jpg' }), image({ path: '/tmp/b.jpg' })] as never);

    const result = await choosePhotos(3);

    expect(result).toHaveLength(2);
    expect(openPickerMock).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: true, maxFiles: 3, cropping: false }),
    );
  });

  it('requests single selection with cropping enabled when only one slot remains', async () => {
    openPickerMock.mockResolvedValue(image() as never);

    const result = await choosePhotos(1);

    expect(result).toEqual([expect.objectContaining({ path: '/tmp/photo.jpg' })]);
    expect(openPickerMock).toHaveBeenCalledWith(
      expect.objectContaining({ multiple: false, maxFiles: 1, cropping: true }),
    );
  });

  it('returns an empty array without calling the picker when no slots remain', async () => {
    const result = await choosePhotos(0);

    expect(result).toEqual([]);
    expect(openPickerMock).not.toHaveBeenCalled();
  });

  it('resolves an empty array on user cancellation', async () => {
    openPickerMock.mockRejectedValue({ code: 'E_PICKER_CANCELLED' });

    await expect(choosePhotos(5)).resolves.toEqual([]);
  });

  it('rejects the whole batch if any selected photo is still over 10 MB', async () => {
    openPickerMock.mockResolvedValue([image(), image({ path: '/tmp/big.jpg', size: 12 * 1024 * 1024 })] as never);

    await expect(choosePhotos(5)).rejects.toBeInstanceOf(PhotoTooLargeError);
  });
});

describe('cleanupTemp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('cleans each given path individually, not the whole temp directory', async () => {
    cleanSingleMock.mockResolvedValue(undefined as never);

    await cleanupTemp(['/tmp/a.jpg', '/tmp/b.jpg']);

    expect(cleanSingleMock).toHaveBeenCalledWith('/tmp/a.jpg');
    expect(cleanSingleMock).toHaveBeenCalledWith('/tmp/b.jpg');
    expect(cleanSingleMock).toHaveBeenCalledTimes(2);
  });

  it('swallows a cleanup failure for an already-removed temp file', async () => {
    cleanSingleMock.mockRejectedValue(new Error('not found'));

    await expect(cleanupTemp(['/tmp/gone.jpg'])).resolves.toBeUndefined();
  });
});
