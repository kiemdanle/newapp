// apps/mobile/__tests__/GiveawayQuickEditModal.test.tsx
import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { GiveawayQuickEditModal } from '../src/features/giveaways/GiveawayQuickEditModal';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { takePhoto, choosePhotos } from '../src/features/products/photo-picker-adapter';
import { uploadGiveawayPhoto } from '../src/api/giveaways';
import type { Giveaway } from '@expyrico/shared';

const mockGiveaway: Giveaway = {
  id: 'g-1',
  giverUserId: 'user-1',
  title: 'Organic Apples',
  description: 'Juicy apples from garden',
  locationText: 'Downtown Market',
  country: 'VN',
  status: 'open',
  photoUrl: 'https://cdn.expyrico.app/photo1.webp',
  photoUrls: ['https://cdn.expyrico.app/photo1.webp'],
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
};

jest.mock('../src/features/products/photo-picker-adapter', () => ({
  takePhoto: jest.fn(),
  choosePhotos: jest.fn(),
}));

jest.mock('../src/api/giveaways', () => ({
  uploadGiveawayPhoto: jest.fn(),
}));

const mockTakePhoto = takePhoto as jest.MockedFunction<typeof takePhoto>;
const mockChoosePhotos = choosePhotos as jest.MockedFunction<typeof choosePhotos>;
const mockUploadPhoto = uploadGiveawayPhoto as jest.MockedFunction<typeof uploadGiveawayPhoto>;

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('GiveawayQuickEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders existing giveaway details and photo', () => {
    const { getByDisplayValue, getByText } = render(
      wrap(
        <GiveawayQuickEditModal
          visible={true}
          giveaway={mockGiveaway}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />,
      ),
    );

    expect(getByDisplayValue('Organic Apples')).toBeTruthy();
    expect(getByDisplayValue('Downtown Market')).toBeTruthy();
    expect(getByDisplayValue('Juicy apples from garden')).toBeTruthy();
    expect(getByText('Photos (1/5)')).toBeTruthy();
    expect(getByText('Cover')).toBeTruthy();
  });

  it('allows adding photos via camera/gallery and removing photos', async () => {
    mockTakePhoto.mockResolvedValueOnce({
      path: '/tmp/photo2.jpg',
      mime: 'image/jpeg',
      width: 800,
      height: 600,
    });

    const { getByText, getByLabelText } = render(
      wrap(
        <GiveawayQuickEditModal
          visible={true}
          giveaway={mockGiveaway}
          onClose={jest.fn()}
          onSave={jest.fn()}
        />,
      ),
    );

    const cameraBtn = getByLabelText('Take a photo with camera');
    fireEvent.press(cameraBtn);

    await waitFor(() => {
      expect(mockTakePhoto).toHaveBeenCalledTimes(1);
      expect(getByText('Photos (2/5)')).toBeTruthy();
    });

    // Remove first photo
    const removeFirstBtn = getByLabelText('Remove photo 1');
    fireEvent.press(removeFirstBtn);

    await waitFor(() => {
      expect(getByText('Photos (1/5)')).toBeTruthy();
    });
  });

  it('uploads newly captured photos and saves patch with updated photo URLs', async () => {
    mockChoosePhotos.mockResolvedValueOnce([
      {
        path: '/tmp/photo3.jpg',
        mime: 'image/jpeg',
        width: 800,
        height: 600,
      },
    ]);

    mockUploadPhoto.mockResolvedValueOnce({
      photoUrl: 'https://cdn.expyrico.app/photo3-uploaded.webp',
      thumbUrl: 'https://cdn.expyrico.app/photo3-thumb.webp',
    });

    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    const { getByLabelText, getByText } = render(
      wrap(
        <GiveawayQuickEditModal
          visible={true}
          giveaway={mockGiveaway}
          onClose={onClose}
          onSave={onSave}
        />,
      ),
    );

    // Pick a photo from gallery
    const galleryBtn = getByLabelText('Select photo from gallery');
    fireEvent.press(galleryBtn);

    await waitFor(() => {
      expect(mockChoosePhotos).toHaveBeenCalledWith(4);
    });

    // Save changes
    const saveBtn = getByText('Save Changes');
    fireEvent.press(saveBtn);

    await waitFor(() => {
      expect(mockUploadPhoto).toHaveBeenCalledWith({ path: '/tmp/photo3.jpg', mime: 'image/jpeg' });
      expect(onSave).toHaveBeenCalledWith({
        title: 'Organic Apples',
        locationText: 'Downtown Market',
        description: 'Juicy apples from garden',
        photoUrl: 'https://cdn.expyrico.app/photo1.webp',
        photoUrls: [
          'https://cdn.expyrico.app/photo1.webp',
          'https://cdn.expyrico.app/photo3-uploaded.webp',
        ],
      });
      expect(onClose).toHaveBeenCalled();
    });
  });
});
