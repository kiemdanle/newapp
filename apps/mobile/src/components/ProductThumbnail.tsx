import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product } from '@expyrico/shared';
import { getBaseUrl } from '../api/client';
import { PrivateProductImage } from '../api/product-private-image';
import { useTheme } from '../theme/useTheme';
import { useCachedImage } from '../cache/useCachedImage';
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
export function parsePhotoUris(raw: string | null | undefined): string[] {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizePhotoUri(item))
          .filter((u): u is string => Boolean(u));
      }
    } catch {
      // fallback to single uri if not json
    }
  }
  const single = normalizePhotoUri(trimmed);
  return single ? [single] : [];
}

export interface ProductThumbnailProps {
  product?: Product | {
    id?: string;
    imageUrl?: string | null;
    status?: string | null;
  } | null;
  firstPhoto?: {
    id?: string;
    displayUrl?: string | null;
    thumbnailUrl?: string | null;
  } | null;
  photoUrl?: string | null;
  size?: number;
  style?: StyleProp<ImageStyle>;
  fallbackIcon?: string;
  hasPhotoOverride?: boolean;
  isLoading?: boolean;
}
export function ProductThumbnail({
  product,
  firstPhoto,
  photoUrl,
  size = 48,
  style,
  fallbackIcon = 'basket-outline',
  hasPhotoOverride = false,
  isLoading = false,
}: ProductThumbnailProps) {
  const theme = useTheme();
  const [failedSources, setFailedSources] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setFailedSources(new Set());
  }, [photoUrl, firstPhoto?.displayUrl, firstPhoto?.thumbnailUrl, product?.imageUrl, product?.id, (product as { photos?: unknown })?.photos]);

  if (isLoading) {
    return (
      <View
        testID="product-thumbnail-skeleton"
        style={[
          { width: size, height: size },
          style,
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.colors.neutralLight },
        ]}
      >
        <View
          style={[
            styles.spinnerBadge,
            {
              width: Math.max(26, Math.round(size * 0.54)),
              height: Math.max(26, Math.round(size * 0.54)),
              borderRadius: Math.round(size * 0.27),
              backgroundColor: theme.colors.bgGlass,
            },
          ]}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  const parsedUris = parsePhotoUris(photoUrl);
  const primaryPhotoUrl = parsedUris[0] ?? photoUrl;
  const productPhotos = (product as { photos?: Array<{ displayUrl?: string | null; thumbnailUrl?: string | null }> } | null | undefined)?.photos;
  const rawCandidates: Array<string | null | undefined> = [
    primaryPhotoUrl,
    firstPhoto?.displayUrl,
    firstPhoto?.thumbnailUrl,
    productPhotos?.[0]?.displayUrl,
    productPhotos?.[0]?.thumbnailUrl,
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
        key={activeCandidate}
        candidate={activeCandidate}
        style={style}
        fallbackIcon={fallbackIcon}
        size={size}
        onError={() => {
          setFailedSources((prev) => new Set([...prev, activeCandidate]));
        }}
        onTimeout={() => {
          setFailedSources((prev) => new Set([...prev, activeCandidate]));
        }}
      />
    );
  }

  // If product is a draft/pending creation and has private photos
  if (product?.id && firstPhoto?.id && product.status !== 'active') {
    return (
      <PrivateProductThumbnail
        key={`draft-${product.id}-${firstPhoto.id}`}
        productId={product.id}
        photoId={firstPhoto.id}
        size={size}
        style={style}
        fallbackIcon={fallbackIcon}
      />
    );
  }

  return (
    <View
      testID="product-thumbnail-fallback"
      style={[
        { width: size, height: size },
        style,
        styles.container,
        {
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.neutralLight,
        },
      ]}
    >
      <View
        style={[
          styles.fallbackBadge,
          {
            width: Math.max(26, Math.round(size * 0.58)),
            height: Math.max(26, Math.round(size * 0.58)),
            borderRadius: Math.round(size * 0.29),
            backgroundColor: theme.colors.bgGlass,
          },
        ]}
      >
        <Ionicons
          name={fallbackIcon as never}
          size={Math.max(14, Math.round(size * 0.36))}
          color={theme.colors.primaryDark}
        />
      </View>
    </View>
  );
}

function PrivateProductThumbnail({
  productId,
  photoId,
  size,
  style,
  fallbackIcon = 'basket-outline',
}: {
  productId: string;
  photoId: string;
  size: number;
  style?: StyleProp<ImageStyle>;
  fallbackIcon?: string;
}) {
  const theme = useTheme();
  const { uri, isLoading, error } = useCachedImage({
    target: { kind: 'draft', productId },
    photoId,
    variant: 'thumb',
  });

  if (isLoading && !uri) {
    return (
      <View
        testID="product-thumbnail-skeleton"
        style={[
          { width: size, height: size },
          style,
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.colors.neutralLight },
        ]}
      >
        <View
          style={[
            styles.spinnerBadge,
            {
              width: Math.max(26, Math.round(size * 0.54)),
              height: Math.max(26, Math.round(size * 0.54)),
              borderRadius: Math.round(size * 0.27),
              backgroundColor: theme.colors.bgGlass,
            },
          ]}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  if (error || !uri) {
    return (
      <View
        testID="product-thumbnail-fallback"
        style={[
          { width: size, height: size },
          style,
          styles.container,
          {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.neutralLight,
          },
        ]}
      >
        <View
          style={[
            styles.fallbackBadge,
            {
              width: Math.max(26, Math.round(size * 0.58)),
              height: Math.max(26, Math.round(size * 0.58)),
              borderRadius: Math.round(size * 0.29),
              backgroundColor: theme.colors.bgGlass,
            },
          ]}
        >
          <Ionicons
            name={fallbackIcon as never}
            size={Math.max(14, Math.round(size * 0.36))}
            color={theme.colors.primaryDark}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style, styles.container]}>
      <Image
        testID="product-thumbnail-image"
        source={{ uri }}
        style={[{ width: size, height: size }, style]}
        resizeMode="cover"
        fadeDuration={150}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
function CachedThumbnailImage({
  candidate,
  style,
  fallbackIcon = 'basket-outline',
  size = 48,
  onError,
  onTimeout,
}: {
  candidate: string;
  style?: StyleProp<ImageStyle>;
  fallbackIcon?: string;
  size?: number;
  onError: () => void;
  onTimeout?: () => void;
}) {
  const theme = useTheme();
  const { uri, isLoading: isCacheLoading } = useCachedImage(candidate);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  // Gate candidate behind cache resolution: do not determine renderUri or mount <Image>
  // while L2 disk cache lookup is in flight, preventing premature remote HTTP requests.
  const isResolvingCache = isCacheLoading && !uri;
  const renderUri = isResolvingCache ? null : (uri || candidate);

  const [settledUri, setSettledUri] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const isSettled = Boolean(renderUri && settledUri === renderUri);

  useEffect(() => {
    setTimedOut(false);
    setSettledUri(null);
  }, [candidate, renderUri]);

  // 10-second safety timer must only run once renderUri is resolved (cache check completed)
  useEffect(() => {
    if (!renderUri || isSettled) return;
    const timer = setTimeout(() => {
      setSettledUri(renderUri);
      setTimedOut(true);
      onTimeoutRef.current?.();
    }, 10000);
    return () => clearTimeout(timer);
  }, [renderUri, isSettled]);

  if (timedOut) {
    return (
      <View
        testID="product-thumbnail-fallback"
        style={[
          { width: size, height: size },
          style,
          styles.container,
          {
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.colors.neutralLight,
          },
        ]}
      >
        <View
          style={[
            styles.fallbackBadge,
            {
              width: Math.max(26, Math.round(size * 0.58)),
              height: Math.max(26, Math.round(size * 0.58)),
              borderRadius: Math.round(size * 0.29),
              backgroundColor: theme.colors.bgGlass,
            },
          ]}
        >
          <Ionicons
            name={fallbackIcon as never}
            size={Math.max(14, Math.round(size * 0.36))}
            color={theme.colors.primaryDark}
          />
        </View>
      </View>
    );
  }
  // While L2 cache lookup is in flight, display the skeleton and DO NOT mount <Image>
  if (isResolvingCache || !renderUri) {
    return (
      <View
        testID="product-thumbnail-skeleton"
        style={[
          { width: size, height: size },
          style,
          styles.container,
          styles.loadingContainer,
          { backgroundColor: theme.colors.neutralLight },
        ]}
      >
        <View
          style={[
            styles.spinnerBadge,
            {
              width: Math.max(26, Math.round(size * 0.54)),
              height: Math.max(26, Math.round(size * 0.54)),
              borderRadius: Math.round(size * 0.27),
              backgroundColor: theme.colors.bgGlass,
            },
          ]}
        >
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[{ width: size, height: size }, style, styles.container]}>
      <Image
        testID="product-thumbnail-image"
        source={{ uri: renderUri }}
        style={[{ width: size, height: size }, style]}
        resizeMode="cover"
        fadeDuration={150}
        accessibilityIgnoresInvertColors
        onLoadEnd={() => {
          setSettledUri(renderUri);
          setTimedOut(false);
        }}
        onError={() => {
          setSettledUri(renderUri);
          onError();
        }}
      />
      {!isSettled && (
        <View
          testID="product-thumbnail-skeleton"
          style={[
            StyleSheet.absoluteFillObject,
            styles.loadingContainer,
            { backgroundColor: theme.colors.neutralLight },
          ]}
          pointerEvents="none"
        >
          <View
            style={[
              styles.spinnerBadge,
              {
                width: Math.max(26, Math.round(size * 0.54)),
                height: Math.max(26, Math.round(size * 0.54)),
                borderRadius: Math.round(size * 0.27),
                backgroundColor: theme.colors.bgGlass,
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  hiddenImage: {
    opacity: 0,
  },
  fill: {
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
