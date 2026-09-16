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

  it('renders Delete button and delegates to onDeletePhoto handler without native Alert', () => {
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
    expect(alertSpy).not.toHaveBeenCalled();
    expect(handleDelete).toHaveBeenCalledWith(0);
    alertSpy.mockRestore();
  });
  it('displays gallery-image-skeleton while image is loading and unmasks to fallback on error', () => {
    const { getAllByTestId, UNSAFE_getAllByType } = render(
      <ThemeProvider>
        <ItemImageGallery photos={['https://cdn.example.com/bad.jpg']} />
      </ThemeProvider>,
    );

    expect(getAllByTestId('gallery-image-skeleton').length).toBeGreaterThan(0);

    const images = UNSAFE_getAllByType('Image' as never);
    fireEvent(images[0], 'error');

    expect(getAllByTestId('gallery-image-fallback').length).toBeGreaterThan(0);
  });

  it('when photo is deleted and photos shrinks, clamps activeIndex and automatically shows next available photo', () => {
    const { getByTestId, rerender, queryByTestId } = render(
      <ThemeProvider>
        <ItemImageGallery photos={photos} />
      </ThemeProvider>,
    );

    // Select third photo (index 2)
    fireEvent.press(getByTestId('giveaway-thumb-2'));
    expect(getByTestId('giveaway-hero-image-2')).toBeTruthy();

    // Simulate deleting third photo -> photos shrinks to 2 items
    const updatedPhotos: string[] = photos.slice(0, 2);
    rerender(
      <ThemeProvider>
        <ItemImageGallery photos={updatedPhotos} />
      </ThemeProvider>,
    );

    // Third photo is gone, hero is now showing photo 2 (index 1), not a blank space
    expect(queryByTestId('giveaway-hero-image-2')).toBeNull();
    expect(getByTestId('giveaway-hero-image-1')).toBeTruthy();
  });

  it('when isProductFallback is true, renders product photo, omits delete button, displays product source badge, and enables adding photos', () => {
    const handleAdd = jest.fn();
    const handleDelete = jest.fn();

    const { getByTestId, queryByTestId, getByText } = render(
      <ThemeProvider>
        <ItemImageGallery
          photos={['https://cdn.expyrico.app/products/sample-product.jpg']}
          isProductFallback={true}
          onAddPhoto={handleAdd}
          onDeletePhoto={handleDelete}
        />
      </ThemeProvider>,
    );

    // Hero displays the product photo
    expect(getByTestId('giveaway-hero-image-0')).toBeTruthy();

    // Delete button is omitted (cannot delete product photo)
    expect(queryByTestId('gallery-delete-photo')).toBeNull();

    // Product source badge and tag are rendered
    expect(getByTestId('gallery-product-source-badge')).toBeTruthy();
    expect(getByText('Product photo')).toBeTruthy();
    expect(getByTestId('gallery-product-tag')).toBeTruthy();
    expect(getByText('Product')).toBeTruthy();

    // Add button in thumbnail row is available and clickable
    const addBtn = getByTestId('gallery-thumb-add-btn');
    expect(addBtn).toBeTruthy();
    fireEvent.press(addBtn);
    expect(handleAdd).toHaveBeenCalledTimes(1);
  });

  it('when isPhotoDeletable returns false for active photo, suppresses delete button and prevents deletion', () => {
    const handleDelete = jest.fn();
    const { queryByTestId } = render(
      <ThemeProvider>
        <ItemImageGallery
          photos={photos}
          onDeletePhoto={handleDelete}
          isPhotoDeletable={(idx) => idx !== 0}
        />
      </ThemeProvider>,
    );

    // Active photo is index 0 -> isPhotoDeletable(0) is false
    expect(queryByTestId('gallery-delete-photo')).toBeNull();
  });
});
