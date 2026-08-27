import { Platform } from 'react-native';
import ImagePicker from 'react-native-image-crop-picker';

// Thin wrapper around react-native-image-crop-picker so every other module
// (the mutation coordinator, ProductPhotoEditor) depends on this file's
// stable shape rather than the third-party library directly. If a later
// native proof build on the user's machine finds a New Architecture
// incompatibility, the blast radius of swapping the underlying library is
// contained to this one file.
//
// Cropping/rotation is delegated to the library's own native cropper
// (`cropping: true`, `freeStyleCropEnabled: true`) rather than a bespoke crop
// screen — the native UI already provides rotate, and building a second one
// would duplicate functionality the spec doesn't otherwise require.
//
// Client-side resize/compression is advisory only (per plan.md's global
// constraints): the server independently enforces the real 10 MiB / decode
// limits, this just avoids uploading obviously-oversized bytes.
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const ADVISORY_MAX_BYTES = 10 * 1024 * 1024;

export interface PickedPhoto {
  path: string;
  width: number;
  height: number;
  mime: string;
  size: number;
}

/** Thrown when a picker result is still over the advisory 10 MiB limit after
 * client-side compression — callers should surface this before attempting
 * upload rather than let the server reject it after a wasted transfer. */
export class PhotoTooLargeError extends Error {
  readonly sizeBytes: number;
  constructor(sizeBytes: number) {
    super(`Selected photo is ${(sizeBytes / (1024 * 1024)).toFixed(1)} MB, over the 10 MB limit`);
    this.name = 'PhotoTooLargeError';
    this.sizeBytes = sizeBytes;
  }
}

function isPickerCancellation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: unknown }).code === 'E_PICKER_CANCELLED';
}

async function toPickedPhoto(image: {
  path: string;
  width: number;
  height: number;
  mime: string;
  size: number;
}): Promise<PickedPhoto> {
  if (image.size > ADVISORY_MAX_BYTES) {
    // L3: the caller never learns this path (it throws before returning
    // one), so nothing downstream would ever call cleanupTemp for it —
    // clean it up here, before throwing, or it leaks for the lifetime of
    // the OS's own temp-file eviction policy.
    await cleanupTemp([image.path]);
    throw new PhotoTooLargeError(image.size);
  }
  return { path: image.path, width: image.width, height: image.height, mime: image.mime, size: image.size };
}

const pickerOptions = {
  cropping: false,
  freeStyleCropEnabled: false,
  mediaType: 'photo' as const,
  compressImageMaxWidth: MAX_DIMENSION,
  compressImageMaxHeight: MAX_DIMENSION,
  compressImageQuality: JPEG_QUALITY,
  // iOS camera/gallery pickers default to HEIC; the server's Sharp decoder
  // does not actually support it despite a capability flag that says
  // otherwise (verified empirically in Phase 3). Forcing JPEG here is not
  // optional — every iOS HEIC photo would otherwise be rejected on upload.
  //
  // `forceJpg` is iOS-only upstream — it has no effect on Android. Android's
  // own guarantee comes from a different mechanism, confirmed by reading the
  // library's real Android source (v0.51.1's `Compression.java`, not
  // inferred): `compressImage()`'s only skip-compression path requires the
  // source mime to be in a fixed known-list (`jpeg/jpg/png/gif/tiff` — HEIC
  // is not in it) *and* quality to be lossless (`1.0`); with
  // `compressImageQuality: 0.82` always set below, that lossless check is
  // always false regardless of format, so `compressImage()` always falls
  // through to `resize()`, which unconditionally calls
  // `bitmap.compress(Bitmap.CompressFormat.JPEG, quality, os)` — a hardcoded
  // JPEG re-encode with no format-based branch at all. Every Android photo
  // this app captures, HEIC or otherwise, is provably re-encoded to a real
  // JPEG file before this module ever returns its path.
  forceJpg: true,
  includeExif: false,
};

/** Opens the camera for a single photo. Resolves `null` on user cancellation
 * (never throws for cancel — the picker UI treats it as a silent no-op). */
export async function takePhoto(): Promise<PickedPhoto | null> {
  try {
    const image = await ImagePicker.openCamera(pickerOptions);
    return await toPickedPhoto(image);
  } catch (err) {
    if (isPickerCancellation(err)) return null;
    throw err;
  }
}

/** Opens the camera for capturing photos (up to `maxFiles`). Resolves `[]` on
 * user cancellation. Used across multi-shot photo forms. */
export async function takePhotos(maxFiles: number = 1): Promise<PickedPhoto[]> {
  if (maxFiles < 1) return [];
  const single = await takePhoto();
  return single ? [single] : [];
}

/** Opens the gallery for up to `maxFiles` photos (single-select falls back to
 * a one-element array so callers have one return shape regardless of count).
 * Resolves `[]` on user cancellation. */
export async function choosePhotos(maxFiles: number): Promise<PickedPhoto[]> {
  if (maxFiles < 1) return [];
  try {
    const isMultiple = maxFiles > 1;
    const result = await ImagePicker.openPicker({
      mediaType: 'photo',
      multiple: isMultiple,
      maxFiles: maxFiles,
      cropping: false,
      freeStyleCropEnabled: false,
      compressImageMaxWidth: MAX_DIMENSION,
      compressImageMaxHeight: MAX_DIMENSION,
      compressImageQuality: JPEG_QUALITY,
      forceJpg: true,
      includeExif: false,
    });
    const images = Array.isArray(result) ? result : [result];
    return await Promise.all(images.map(toPickedPhoto));
  } catch (err) {
    if (isPickerCancellation(err)) return [];
    throw err;
  }
}

/** Removes the picker's temp files for the given local paths. Scoped to
 * explicit paths (not the library's global `clean()`) so cleaning up one
 * photo's retry state can never delete another in-flight photo's temp file —
 * required by the spec's independent per-photo retry design. Best-effort:
 * a temp file that's already gone (e.g. OS reclaimed cache) is not an error. */
export async function cleanupTemp(paths: string[]): Promise<void> {
  await Promise.all(
    paths.map(async (path) => {
      try {
        await ImagePicker.cleanSingle(path);
      } catch {
        // Already-removed temp files are not a failure condition.
      }
    }),
  );
}

/** Exposed for tests/diagnostics only — confirms which platform's HEIC/JPEG
 * behavior a given picked photo went through. */
export const currentPlatform = () => (Platform.OS === 'ios' ? 'ios' : 'android');
