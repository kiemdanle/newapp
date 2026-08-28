import React, { useState } from 'react';
import { Image, View, type ImageStyle, type StyleProp } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product } from '@expyrico/shared';
import { getBaseUrl } from '../api/client';
import { PrivateProductImage } from '../api/product-private-image';
import { useTheme } from '../theme/useTheme';
import { useCachedImage } from '../cache/useCachedImage';
export interface ProductThumbnailProps {
  product?: Product | null;
  photoUrl?: string | null;
  style?: StyleProp<ImageStyle>;
  fallbackIcon?: string;
  size?: number;
}
export function normalizePhotoUri(uri: string | null | undefined): string | null {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('content://') ||
    trimmed.startsWith('ph://')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/v1/') || trimmed.startsWith('/public-media/')) {
    return `${getBaseUrl()}${trimmed}`;
  }
  if (trimmed.startsWith('/')) {
    return `file://${trimmed}`;
  }
  return trimmed;
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
  const [failedSources, setFailedSources] = useState<Set<string>>(new Set());
  const firstPhoto = product?.photos && product.photos.length > 0 ? product.photos[0] : null;

  // Candidate sources in order of preference
  const rawCandidates: Array<string | null | undefined> = [
    photoUrl,
    firstPhoto?.displayUrl,
    firstPhoto?.thumbnailUrl,
    product?.imageUrl,
  ];

  const candidates: string[] = [];
  for (const raw of rawCandidates) {
    const norm = normalizePhotoUri(raw);
    if (norm && !candidates.includes(norm)) {
      candidates.push(norm);
    }
  }

  // Find first candidate that has not failed
  const activeCandidate = candidates.find((c) => !failedSources.has(c));

  if (activeCandidate) {
    return (
      <CachedThumbnailImage
        candidate={activeCandidate}
        style={style}
        onError={() => {
          setFailedSources((prev) => new Set([...prev, activeCandidate]));
        }}
      />
    );
  }

  // If product is a draft/pending creation and has private photos
  if (product?.id && firstPhoto?.id && product.status !== 'active') {
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

function CachedThumbnailImage({
  candidate,
  style,
  onError,
}: {
  candidate: string;
  style?: StyleProp<ImageStyle>;
  onError: () => void;
}) {
  const { uri } = useCachedImage(candidate);
  const renderUri = uri || candidate;

  return (
    <Image
      key={renderUri}
      source={{
        uri: renderUri,
        cache: 'force-cache',
      }}
      style={style}
      resizeMode="cover"
      fadeDuration={150}
      accessibilityIgnoresInvertColors
      onError={onError}
    />
  );
}
