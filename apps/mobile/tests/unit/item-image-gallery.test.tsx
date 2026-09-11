import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ItemImageGallery } from '../../src/components/ItemImageGallery';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 47, right: 0, bottom: 34, left: 0 })),
}));

describe('ItemImageGallery with Multi-Photo & Thumbnail Support', () => {
  const photos = [
    'https://cdn.expyrico.app/photos/item1.jpg',
    'https://cdn.expyrico.app/photos/item2.jpg',
    'https://cdn.expyrico.app/photos/item3.jpg',
  ];

  it('renders hero carousel, page counter, and thumbnails for multiple photos', () => {
    const { getByText, getByTestId, getByLabelText } = render(
      <ThemeProvider>
        <ItemImageGallery photos={photos} title="Greek Yogurt" />
      </ThemeProvider>,
    );

    expect(getByText('1/3')).toBeTruthy();
    expect(getByText('Cover')).toBeTruthy();
    expect(getByTestId('giveaway-thumb-0')).toBeTruthy();
    expect(getByTestId('giveaway-thumb-1')).toBeTruthy();
    expect(getByTestId('giveaway-thumb-2')).toBeTruthy();
    expect(getByLabelText('Show photo 1')).toBeTruthy();
    expect(getByLabelText('Show photo 2')).toBeTruthy();
    expect(getByLabelText('Show photo 3')).toBeTruthy();
  });

  it('taps thumbnail to switch the active photo in the hero view', () => {
    const { getByText, getByTestId } = render(
      <ThemeProvider>
        <ItemImageGallery photos={photos} title="Greek Yogurt" />
      </ThemeProvider>,
    );

    // Tap thumbnail 2
    fireEvent.press(getByTestId('giveaway-thumb-1'));

    // Thumbnail 2 is now active
    expect(getByTestId('giveaway-thumb-1')).toBeTruthy();
    expect(getByText('2/3')).toBeTruthy();
  });

  it('opens FullScreenImageViewer with swipe-down-to-dismiss when hero image is tapped', () => {
    const { getByText, getByLabelText, getByTestId } = render(
      <ThemeProvider>
        <ItemImageGallery photos={photos} title="Greek Yogurt" />
      </ThemeProvider>,
    );

    // Tap hero image to open fullscreen viewer
    fireEvent.press(getByTestId('giveaway-hero-image-0'));

    expect(getByText('Greek Yogurt')).toBeTruthy();
    expect(getByLabelText('Close gallery')).toBeTruthy();
  });

  it('renders clean placeholder when no photos are provided', () => {
    const { getByText } = render(
      <ThemeProvider>
        <ItemImageGallery photos={[]} placeholderText="No item photo" />
      </ThemeProvider>,
    );

    expect(getByText('No item photo')).toBeTruthy();
  });

  it('renders thumb-add button when onAddPhoto is provided and capacity remains, and omits add button inside photo', () => {
    const handleAdd = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <ThemeProvider>
        <ItemImageGallery photos={photos} onAddPhoto={handleAdd} maxPhotos={5} />
      </ThemeProvider>,
    );

    // No add button placed inside the photo
    expect(queryByTestId('gallery-add-photo')).toBeNull();

    // Add button is rendered in the thumbnail strip
    const thumbAddBtn = getByTestId('gallery-thumb-add-btn');
    expect(thumbAddBtn).toBeTruthy();
    fireEvent.press(thumbAddBtn);
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });

  it('renders Delete button and triggers onDeletePhoto after confirmation alert', () => {
    const handleDelete = jest.fn();
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByTestId } = render(
      <ThemeProvider>
        <ItemImageGallery photos={photos} onDeletePhoto={handleDelete} />
      </ThemeProvider>,
    );

    const deleteBtn = getByTestId('gallery-delete-photo');
    expect(deleteBtn).toBeTruthy();

    fireEvent.press(deleteBtn);
    expect(alertSpy).toHaveBeenCalledWith(
      'Delete Photo',
      expect.stringContaining('Are you sure you want to remove this photo'),
      expect.any(Array),
    );

    // Trigger the destructive action from the alert buttons
    const buttons = alertSpy.mock.calls[0]?.[2] as Array<{ text: string; onPress?: () => void }>;
    const deleteConfirm = buttons.find((b) => b.text === 'Delete');
    deleteConfirm?.onPress?.();

    expect(handleDelete).toHaveBeenCalledWith(0);
    alertSpy.mockRestore();
  });
});
