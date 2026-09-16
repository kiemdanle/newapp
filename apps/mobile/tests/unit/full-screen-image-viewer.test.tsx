import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { FullScreenImageViewer } from '../../src/components/FullScreenImageViewer';
import { ThemeProvider } from '../../src/theme/ThemeProvider';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 47, right: 0, bottom: 34, left: 0 })),
}));

describe('FullScreenImageViewer', () => {
  it('renders photos, counter, drag handle, and title when visible', () => {
    const onClose = jest.fn();
    const photos = ['https://cdn.expyrico.app/photos/1.jpg', 'https://cdn.expyrico.app/photos/2.jpg'];

    const { getByText, getByLabelText } = render(
      <ThemeProvider>
        <FullScreenImageViewer
          visible={true}
          photos={photos}
          title="Apples & Oranges"
          onClose={onClose}
        />
      </ThemeProvider>,
    );

    expect(getByText('Apples & Oranges')).toBeTruthy();
    expect(getByText(/1 \/ 2/)).toBeTruthy();
    expect(getByLabelText('Close gallery')).toBeTruthy();
  });

  it('triggers onClose when close button is pressed', () => {
    const onClose = jest.fn();
    const photos = ['https://cdn.expyrico.app/photos/1.jpg'];

    const { getByLabelText } = render(
      <ThemeProvider>
        <FullScreenImageViewer
          visible={true}
          photos={photos}
          title="Single Photo"
          onClose={onClose}
        />
      </ThemeProvider>,
    );

    fireEvent.press(getByLabelText('Close gallery'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('returns null when not visible or photos array is empty', () => {
    const { queryByText } = render(
      <ThemeProvider>
        <FullScreenImageViewer
          visible={false}
          photos={['https://cdn.expyrico.app/photos/1.jpg']}
          title="Invisible Photo"
          onClose={jest.fn()}
        />
      </ThemeProvider>,
    );

    expect(queryByText('Invisible Photo')).toBeNull();
  });

  it('allows navigating to newly added photos when photos prop dynamically expands without unmounting', () => {
    const initialPhotos = [
      'https://cdn.expyrico.app/photos/1.jpg',
      'https://cdn.expyrico.app/photos/2.jpg',
      'https://cdn.expyrico.app/photos/3.jpg',
    ];

    const { getByTestId, getByText, rerender } = render(
      <ThemeProvider>
        <FullScreenImageViewer
          visible={true}
          photos={initialPhotos}
          initialIndex={2}
          title="Pantry Item"
          onClose={jest.fn()}
        />
      </ThemeProvider>,
    );

    expect(getByText(/3 \/ 3/)).toBeTruthy();

    // User adds a 4th photo while the screen is open
    const expandedPhotos = [
      ...initialPhotos,
      'https://cdn.expyrico.app/photos/4.jpg',
    ];

    rerender(
      <ThemeProvider>
        <FullScreenImageViewer
          visible={true}
          photos={expandedPhotos}
          initialIndex={2}
          title="Pantry Item"
          onClose={jest.fn()}
        />
      </ThemeProvider>,
    );

    // 4th thumbnail is rendered and can be navigated to
    const thumb4 = getByTestId('modal-thumb-3');
    expect(thumb4).toBeTruthy();
    fireEvent.press(thumb4);

    // Counter updates to 4 / 4
    expect(getByText(/4 \/ 4/)).toBeTruthy();
  });
});
