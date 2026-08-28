import React from 'react';
import { Image, type ImageProps } from 'react-native';
import { useCachedImage } from '../cache/useCachedImage';
import { imageDiskCache } from '../cache/image-disk-cache';
import { invalidateTarget } from '../cache/image-revalidator';
import { useSessionStore } from '../auth/session-store';
import type {
  PrivateMediaTarget,
  PrivateMediaVariant,
} from '../cache/image-cache-types';

export type { PrivateMediaTarget, PrivateMediaVariant };

export function parentKey(target: PrivateMediaTarget): string {
  return target.kind === 'draft'
    ? `draft:${target.productId}`
    : `edit:${target.editId}`;
}
export async function purgePrivateImageCache(
  userId?: string | null,
): Promise<void> {
  const uid = userId || useSessionStore.getState().user?.id;
  if (uid) {
    await imageDiskCache.purgeUserPrivate(uid);
  } else {
    await imageDiskCache.purgeAll();
  }
}

export async function purgePrivateImageCacheForTarget(
  target: PrivateMediaTarget,
): Promise<void> {
  const pKey = parentKey(target);
  invalidateTarget(pKey);
  await imageDiskCache.purgeTarget(pKey);
}

export interface DataUriState {
  uri: string | null;
  error: Error | null;
}

export function useAuthorizedDataUri(
  target: PrivateMediaTarget,
  photoId: string,
  variant: PrivateMediaVariant,
): DataUriState {
  const { uri, error } = useCachedImage({
    target,
    photoId,
    variant,
  });

  return { uri, error };
}

export interface PrivateProductImageProps extends Omit<ImageProps, 'source'> {
  target: PrivateMediaTarget;
  photoId: string;
  variant: PrivateMediaVariant;
}

/**
 * Renders a privately-authorized product/edit photo. Never passes the
 * bearer token in a URL — bytes are fetched once with an Authorization
 * header and handed to <Image> as a `data:` URI or cached local file.
 */
export function PrivateProductImage({
  target,
  photoId,
  variant,
  ...imageProps
}: PrivateProductImageProps) {
  const { uri } = useAuthorizedDataUri(target, photoId, variant);
  if (!uri) return null;
  return (
    <Image
      {...imageProps}
      source={{ uri, cache: 'force-cache' }}
      accessibilityIgnoresInvertColors
    />
  );
}
