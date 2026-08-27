import React from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product } from '@expyrico/shared';
import { PrivateProductImage } from '../api/product-private-image';
import { useTheme } from '../theme/useTheme';

export interface ProductThumbnailProps {
  product?: Product | null;
  photoUrl?: string | null;
  style?: StyleProp<ImageStyle>;
  fallbackIcon?: string;
  size?: number;
}

/**
 * Universal product image thumbnail component that seamlessly resolves:
 * 1. Local or public photo URLs (from record.photoUrl or product.imageUrl).
 * 2. Public CDN photo URLs (from product.photos[0].displayUrl / thumbnailUrl).
 * 3. Authenticated private media for user-created draft/pending products (via PrivateProductImage).
 * 4. Elegant fallback placeholder icon when no image exists.
 */
export function ProductThumbnail({
  product,
  photoUrl,
  style,
  fallbackIcon = 'nutrition-outline',
  size = 52,
}: ProductThumbnailProps) {
  const theme = useTheme();
  const firstPhoto = product?.photos && product.photos.length > 0 ? product.photos[0] : null;

  const publicCandidate =
    photoUrl ||
    product?.imageUrl ||
    (firstPhoto?.thumbnailUrl?.startsWith('http')
      ? firstPhoto.thumbnailUrl
      : firstPhoto?.displayUrl?.startsWith('http')
        ? firstPhoto.displayUrl
        : null);

  if (publicCandidate) {
    return (
      <Image
        source={{ uri: publicCandidate }}
        style={style}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }

  if (product?.id && firstPhoto?.id) {
    return (
      <PrivateProductImage
        target={{ kind: 'draft', productId: product.id }}
        photoId={firstPhoto.id}
        variant="thumb"
        style={style}
      />
    );
  }

  return (
    <View
      style={[
        style,
        {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.neutralLight,
        },
      ]}
    >
      <Ionicons name={fallbackIcon as never} size={size * 0.46} color={theme.colors.textMuted} />
    </View>
  );
}
