import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { normalizePhotoUri, ProductThumbnail } from './ProductThumbnail';
import { ThemeProvider } from '../theme/ThemeProvider';
import type { Product } from '@expyrico/shared';

const mockProduct: Product = {
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  barcode: '8938527970020',
  qrPayload: null,
  name: 'Macca Nuts',
  description: 'Premium roasted macca',
  brand: 'Ong Ba',
  category: 'Snacks',
  imageUrl: 'https://cdn.example.com/cover.webp',
  defaultShelfLifeDays: 90,
  source: 'user',
  sourceId: null,
  isCommunityEligible: true,
  buyAgainCount: 0,
  buyAgainOnSaleCount: 0,
  wontBuyCount: 0,
  ratingCount: 0,
  reviewCount: 0,
  status: 'active',
  version: 2,
  photos: [
    {
      id: 'photo-1',
      position: 0,
      thumbnailUrl: 'https://cdn.example.com/thumb.webp',
      displayUrl: 'https://cdn.example.com/display.webp',
    },
  ],
  createdAt: '2026-08-20T00:00:00.000Z',
  updatedAt: '2026-08-27T00:00:00.000Z',
};

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('normalizePhotoUri', () => {
  it('handles absolute http/https/file/data/ph/content URIs', () => {
    expect(normalizePhotoUri('https://example.com/img.jpg')).toBe('https://example.com/img.jpg');
    expect(normalizePhotoUri('http://example.com/img.jpg')).toBe('http://example.com/img.jpg');
    expect(normalizePhotoUri('file:///var/mobile/img.jpg')).toBe('file:///var/mobile/img.jpg');
    expect(normalizePhotoUri('data:image/webp;base64,AAAA')).toBe('data:image/webp;base64,AAAA');
  });

  it('prepends API base URL to relative /public-media/ and /v1/ endpoints', () => {
    expect(normalizePhotoUri('/public-media/products/123/display.webp')).toContain('/public-media/products/123/display.webp');
    expect(normalizePhotoUri('/v1/products/123/photos/456/display')).toContain('/v1/products/123/photos/456/display');
  });

  it('handles empty, whitespace or non-string inputs', () => {
    expect(normalizePhotoUri(null)).toBeNull();
    expect(normalizePhotoUri(undefined)).toBeNull();
    expect(normalizePhotoUri('   ')).toBeNull();
  });
});

describe('ProductThumbnail', () => {
  it('renders photo from product.photos for approved active product', () => {
    const { getByRole, queryByRole } = renderWithTheme(<ProductThumbnail product={mockProduct} />);

    // In react-native, Image is rendered with accessibilityIgnoresInvertColors
    const images = renderWithTheme(<ProductThumbnail product={mockProduct} />).UNSAFE_getAllByType('Image' as never);
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images[0].props.source.uri).toBe('https://cdn.example.com/display.webp');
  });

  it('falls back to second candidate when primary candidate triggers onError', () => {
    const component = renderWithTheme(
      <ProductThumbnail
        product={mockProduct}
        photoUrl="file:///stale/path/that/does/not/exist.jpg"
      />,
    );

    const images = component.UNSAFE_getAllByType('Image' as never);
    expect(images[0].props.source.uri).toBe('file:///stale/path/that/does/not/exist.jpg');

    // Simulate image error on the broken local photo
    fireEvent(images[0], 'error');

    // Should fall back to product photos displayUrl
    const updatedImages = component.UNSAFE_getAllByType('Image' as never);
    expect(updatedImages[0].props.source.uri).toBe('https://cdn.example.com/display.webp');
  });

  it('renders fallback icon when no image sources exist', () => {
    const productWithoutPhotos: Product = {
      ...mockProduct,
      imageUrl: null,
      photos: [],
    };

    const { getByTestId, UNSAFE_queryAllByType } = renderWithTheme(
      <ProductThumbnail product={productWithoutPhotos} />,
    );

    const images = UNSAFE_queryAllByType('Image' as never);
    expect(images.length).toBe(0);
  });
});
