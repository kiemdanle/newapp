import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { Product } from '@expyrico/shared';
import { getBaseUrl } from '../api/client';
import { PrivateProductImage } from '../api/product-private-image';
import { useTheme } from '../theme/useTheme';
import { useCachedImage } from '../cache/useCachedImage';
import { SkeletonBone, SkeletonShimmer } from './skeleton';
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

  if (isLoading) {
    return (
      <View
        testID="product-thumbnail-skeleton"
        style={[
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
  const rawCandidates: Array<string | null | undefined> = [
    firstPhoto?.displayUrl,
    firstPhoto?.thumbnailUrl,
    primaryPhotoUrl,
    hasPhotoOverride ? null : product?.imageUrl,
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
        fallbackIcon={fallbackIcon}
        size={size}
        onError={() => {
          setFailedSources((prev) => new Set([...prev, activeCandidate]));
        }}
        onTimeout={() => {
          setFailedSources((prev) => new Set([...prev, ...candidates]));
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
      testID="product-thumbnail-fallback"
      style={[
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
  const { uri } = useCachedImage(candidate);
  const renderUri = uri || candidate;
  const [settledUri, setSettledUri] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const isSettled = Boolean(settledUri && settledUri === renderUri);

  useEffect(() => {
    setTimedOut(false);
  }, [renderUri]);

  useEffect(() => {
    if (isSettled) return;
    const timer = setTimeout(() => {
      setSettledUri(renderUri);
      setTimedOut(true);
      onTimeoutRef.current?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [renderUri, isSettled]);
  if (timedOut) {
    return (
      <View
        testID="product-thumbnail-fallback"
        style={[
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
    <View style={[style, styles.container]}>
      <Image
        source={{
          uri: renderUri,
          cache: 'force-cache',
        }}
        style={[style, !isSettled && styles.hiddenImage]}
        resizeMode="cover"
        fadeDuration={150}
        accessibilityIgnoresInvertColors
        onLoadEnd={() => setSettledUri(renderUri)}
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
