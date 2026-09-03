import React from 'react';
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
    const { getByText, getByTestId, getByLabelText } = render(
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
});
