import React from 'react';
import { Dimensions } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { GiveawayImageGallery } from '../src/features/giveaways/GiveawayImageGallery';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const samplePhotos = [
  'https://cdn.example.com/photos/photo1.webp',
  'https://cdn.example.com/photos/photo2.webp',
  'https://cdn.example.com/photos/photo3.webp',
  'https://cdn.example.com/photos/photo4.webp',
];

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('GiveawayImageGallery', () => {
  it('renders placeholder when no photos are provided', () => {
    const { getByText } = wrap(<GiveawayImageGallery photos={[]} title="Sample Item" />);
    expect(getByText('No photos provided')).toBeTruthy();
  });

  it('renders hero carousel, page indicator badge, and thumbnail strip for multi-photo gallery', () => {
    const { getByText, getByLabelText } = wrap(
      <GiveawayImageGallery photos={samplePhotos} title="Organic Honey" />,
    );

    // Initial page counter
    expect(getByText('1/4')).toBeTruthy();

    // Thumbnails
    expect(getByText('Cover')).toBeTruthy();
    expect(getByLabelText('Show photo 1')).toBeTruthy();
    expect(getByLabelText('Show photo 2')).toBeTruthy();
    expect(getByLabelText('Show photo 3')).toBeTruthy();
    expect(getByLabelText('Show photo 4')).toBeTruthy();
  });

  it('opens fullscreen modal on tapping photo and displays full swipeable viewer', () => {
    const { getByLabelText, getByText } = wrap(
      <GiveawayImageGallery photos={samplePhotos} title="Organic Honey" />,
    );

    // Open fullscreen modal on photo 2
    fireEvent.press(getByLabelText('View photo 2 of 4 full screen'));

    // Modal header shows title and index
    expect(getByText('Organic Honey')).toBeTruthy();
    expect(getByText('2 / 4')).toBeTruthy();
    expect(getByLabelText('Close gallery')).toBeTruthy();
  });

  it('allows sliding left/right in fullscreen modal to change photos', () => {
    const { getByLabelText, getByText, getByTestId } = wrap(
      <GiveawayImageGallery photos={samplePhotos} title="Organic Honey" />,
    );

    // Open fullscreen modal on photo 1
    fireEvent.press(getByLabelText('View photo 1 of 4 full screen'));
    expect(getByText('1 / 4')).toBeTruthy();
    // In fullscreen modal, simulate sliding right to photo 2 (offset = 1 screen width)
    const screenWidth = Dimensions.get('window').width;
    const modalScrollView = getByTestId('modal-fullscreen-carousel');
    fireEvent.scroll(modalScrollView, {
      nativeEvent: {
        contentOffset: { x: screenWidth, y: 0 },
        layoutMeasurement: { width: screenWidth, height: 600 },
        contentSize: { width: screenWidth * 4, height: 600 },
      },
    });

    // Subtitle updates to 2 / 4
    expect(getByText('2 / 4')).toBeTruthy();
  });

  it('taps thumbnail in fullscreen modal to jump to specific photo and closes on close button press', () => {
    const { getByLabelText, getByText, queryByLabelText } = wrap(
      <GiveawayImageGallery photos={samplePhotos} title="Organic Honey" />,
    );

    // Open fullscreen modal
    fireEvent.press(getByLabelText('View photo 1 of 4 full screen'));
    expect(getByText('1 / 4')).toBeTruthy();

    // Tap thumbnail 3 in modal
    fireEvent.press(getByLabelText('Go to photo 3'));
    expect(getByText('3 / 4')).toBeTruthy();

    // Close modal
    fireEvent.press(getByLabelText('Close gallery'));
    expect(queryByLabelText('Close gallery')).toBeNull();
  });
});
