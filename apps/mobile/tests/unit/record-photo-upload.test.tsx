import { act, fireEvent, screen } from '@testing-library/react-native';
import RecordDetail from '../../app/(app)/record/[id]';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { useRecordWithStatus, uploadRecordPhoto, saveRecordPhotos } from '../../src/api/records';
import { choosePhotos } from '../../src/features/products/photo-picker-adapter';

jest.mock('../../src/api/records', () => ({
  ...jest.requireActual('../../src/api/records'),
  useRecordWithStatus: jest.fn(),
  uploadRecordPhoto: jest.fn(),
  saveRecordPhotos: jest.fn(),
}));
jest.mock('../../src/api/products', () => ({ useProduct: () => ({ data: null }) }));
jest.mock('../../src/api/households', () => ({ useMyHouseholds: () => ({ data: { items: [] } }) }));
jest.mock('../../src/api/giveaways', () => ({ useActiveGiveawaysForRecord: () => ({ data: [] }) }));
jest.mock('../../src/features/products/photo-picker-adapter', () => ({
  ...jest.requireActual('../../src/features/products/photo-picker-adapter'),
  choosePhotos: jest.fn(),
}));
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useRoute: () => ({ params: { id: 'local-item' } }),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const remotePhoto = { photoUrl: 'https://example.com/photo.webp', thumbUrl: 'https://example.com/thumb.webp' };

async function pickPhoto() {
  fireEvent.press(screen.getByLabelText('Add photo'));
  await act(async () => { fireEvent.press(screen.getByLabelText('Choose photo from photo library')); });
}

beforeEach(() => {
  jest.clearAllMocks();
  (useRecordWithStatus as jest.Mock).mockReturnValue({
    isResolved: true,
    record: {
      id: 'local-item', serverId: 'server-item', clientId: 'client-item',
      productId: null, customName: 'Apples', expiryDate: '2026-12-31',
      quantity: 1, unit: 'pcs', photoUrl: null, localPhotos: [],
      status: 'active', notifyAt: [], householdId: null,
    },
  });
  (choosePhotos as jest.Mock).mockResolvedValue([{ path: 'file:///camera/photo.jpg', mime: 'image/jpeg' }]);
});

it('keeps spinning after file upload until the server acknowledges attachment to the item', async () => {
  const upload = deferred<typeof remotePhoto>();
  const save = deferred<void>();
  (uploadRecordPhoto as jest.Mock).mockReturnValue(upload.promise);
  (saveRecordPhotos as jest.Mock).mockReturnValue(save.promise);
  renderWithTheme(<RecordDetail />, 'expyrico');
  await pickPhoto();
  expect(screen.getByTestId('record-photo-upload-spinner')).toBeTruthy();
  expect(screen.getByTestId('record-photo-upload-progress')).toBeTruthy();
  expect(screen.queryByText(/Please keep this screen open/i)).toBeNull();
  expect(saveRecordPhotos).not.toHaveBeenCalled();
  await act(async () => { upload.resolve(remotePhoto); });
  expect(screen.getByTestId('record-photo-upload-spinner')).toBeTruthy();
  expect(saveRecordPhotos).toHaveBeenCalledWith('local-item', [remotePhoto.photoUrl]);
  await act(async () => { save.resolve(); });
  expect(screen.queryByTestId('record-photo-upload-spinner')).toBeNull();
  expect(screen.queryByText('Photos not saved')).toBeNull();
});

it('reports attachment failure and retries the server save without uploading the file twice', async () => {
  (uploadRecordPhoto as jest.Mock).mockResolvedValue(remotePhoto);
  (saveRecordPhotos as jest.Mock).mockRejectedValueOnce(new Error('HTTP 503'));
  renderWithTheme(<RecordDetail />, 'expyricoDark');
  await pickPhoto();
  expect(screen.getByText('Photos not saved')).toBeTruthy();
  expect(screen.queryByTestId('record-photo-upload-spinner')).toBeNull();
  const retry = deferred<void>();
  (saveRecordPhotos as jest.Mock).mockReturnValue(retry.promise);
  await act(async () => { fireEvent.press(screen.getByText('Retry upload')); });
  expect(screen.getByTestId('record-photo-upload-spinner')).toBeTruthy();
  expect(uploadRecordPhoto).toHaveBeenCalledTimes(1);
  await act(async () => { retry.resolve(); });
  expect(screen.queryByText('Photos not saved')).toBeNull();
  expect(screen.queryByTestId('record-photo-upload-spinner')).toBeNull();
});

it('does not attach failed uploads and allows discarding an unsaved preview', async () => {
  (uploadRecordPhoto as jest.Mock).mockRejectedValue(new Error('HTTP 404'));
  renderWithTheme(<RecordDetail />, 'expyrico');
  await pickPhoto();
  expect(screen.getByText('Photos not saved')).toBeTruthy();
  expect(saveRecordPhotos).not.toHaveBeenCalled();
  fireEvent.press(screen.getByText('Discard photo changes'));
  expect(screen.getByLabelText('Add photo')).toBeTruthy();
  expect(screen.queryByText('Photos not saved')).toBeNull();
});
