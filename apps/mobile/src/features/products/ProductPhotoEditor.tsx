import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { CoordinatedEntity, DraftMutationCoordinator } from './draft-mutation-coordinator';
import { takePhoto, choosePhotos, cleanupTemp, PhotoTooLargeError, type PickedPhoto } from './photo-picker-adapter';
import { PrivateProductImage, type PrivateMediaTarget } from '../../api/product-private-image';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';
import { MultiPhotoCameraModal } from '../../components/MultiPhotoCameraModal';

const MAX_PHOTOS = 5;

type LocalPhotoStatus = 'pending' | 'uploading' | 'failed' | 'uploaded';

interface LocalPhotoEntry {
  localId: string;
  path: string;
  status: LocalPhotoStatus;
  progress: number;
  error: string | null;
  /** Set once the upload succeeds — the server-assigned photo id, used to
   * reconcile this local entry against the coordinator's authoritative
   * `photos` list rather than trusting local ordering after that point. */
  uploadedPhotoId: string | null;
  cancel: (() => void) | null;
}

let localIdCounter = 0;
function nextLocalId(): string {
  localIdCounter += 1;
  return `local-${localIdCounter}`;
}

/** Exported for tests only — this module-level counter otherwise persists
 * across test cases within the same file, since the module loads once. */
export function resetLocalPhotoIdCounterForTests(): void {
  localIdCounter = 0;
}

export interface ProductPhotoEditorProps<T extends CoordinatedEntity> {
  target: PrivateMediaTarget;
  coordinator: DraftMutationCoordinator<T>;
  /** Reports whether any local photo is still `pending`/`uploading` — a
   * submit flow (Task 7) must block while this is true, since the coordinator
   * only serializes mutations it knows about, not a queue entry that hasn't
   * been enqueued yet. */
  onUnsettledChange?: (unsettled: boolean) => void;
}

/**
 * Camera/gallery capture, upload, remove, reorder, and cover selection for
 * up to five product photos. Cropping/rotation happens in the OS-native
 * cropper the picker adapter already opens (see photo-picker-adapter.ts) —
 * this component only manages the queue of local-vs-uploaded entries and
 * their interaction with the serialized mutation coordinator.
 */
export function ProductPhotoEditor<T extends CoordinatedEntity>({ target, coordinator, onUnsettledChange }: ProductPhotoEditorProps<T>) {
  const theme = useTheme();
  const [, forceRerender] = useState(0);
  const [localQueue, setLocalQueue] = useState<LocalPhotoEntry[]>([]);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [cameraModalVisible, setCameraModalVisible] = useState(false);

  // The coordinator owns the authoritative server photo list; this
  // component re-renders whenever it changes by re-reading getState()
  // after every mutation completes (no external store/subscription needed
  // for a component with this narrow a lifetime).
  const serverPhotos = coordinator.getState().photos;
  // Local entries the coordinator has already confirmed uploaded are dropped
  // from render entirely — the server thumbnail above is now the only
  // representation; the local entry's own file was already deleted by
  // `cleanupTemp` in `startUpload`'s success handler, so continuing to
  // render it via `source={{uri: entry.path}}` would point at bytes that no
  // longer exist.
  const visibleLocalQueue = localQueue.filter((e) => e.uploadedPhotoId === null);
  const uploadedLocalCount = localQueue.filter((e) => e.status !== 'failed' && e.uploadedPhotoId === null).length;
  const totalCount = serverPhotos.length + uploadedLocalCount;
  const remaining = Math.max(0, MAX_PHOTOS - totalCount);
  const hasUnsettled = localQueue.some((e) => e.status === 'pending' || e.status === 'uploading');
  // A photo op the coordinator rejects while a conflict is open must
  // never be attempted in the first place — read fresh each render (same
  // pattern as `serverPhotos` above) rather than caching in state, since the
  // coordinator has no "resolved" event to invalidate a cached flag against;
  // the `onConflict` subscription below only needs to force a re-render the
  // moment a *new* conflict opens (nothing else would trigger one at that
  // exact instant). A stale "still blocked" render after a sibling resolves
  // the conflict elsewhere is the safe failure direction — it clears itself
  // on this component's own next re-render (a mutation attempt, a refresh
  // from an unrelated success, or an unrelated prop change).
  const blockedByConflict = coordinator.hasConflict();

  const refresh = useCallback(() => forceRerender((n) => n + 1), []);

  useEffect(() => {
    onUnsettledChange?.(hasUnsettled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsettled]);

  useEffect(() => coordinator.onConflict(() => refresh()), [coordinator, refresh]);

  const updateEntry = useCallback((localId: string, patch: Partial<LocalPhotoEntry>) => {
    setLocalQueue((q) => q.map((e) => (e.localId === localId ? { ...e, ...patch } : e)));
  }, []);

  const startUpload = useCallback(
    (entry: LocalPhotoEntry) => {
      updateEntry(entry.localId, { status: 'uploading', progress: 0, error: null, cancel: null });
      const knownPhotoIdsBefore = new Set(coordinator.getState().photos.map((p) => p.id));
      coordinator
        .enqueue({
          kind: 'upload',
          photo: { path: entry.path, mime: 'image/jpeg' },
          onProgress: (ratio) => updateEntry(entry.localId, { progress: ratio }),
          // Real abort capability — enqueue() itself only resolves with the
          // eventual entity, so this is the only path back to the actual
          // XHR's cancel(). Called once the metadata flush ahead of this
          // upload (if any) has cleared and the transport has actually
          // started.
          onHandle: (handle) => updateEntry(entry.localId, { cancel: handle.cancel }),
        })
        .then(async (updated) => {
          const newPhoto = updated.photos.find((p) => !knownPhotoIdsBefore.has(p.id));
          updateEntry(entry.localId, { status: 'uploaded', progress: 1, uploadedPhotoId: newPhoto?.id ?? null, cancel: null });
          await cleanupTemp([entry.path]);
          refresh();
        })
        .catch((err: unknown) => {
          updateEntry(entry.localId, { status: 'failed', error: (err as Error).message ?? 'Upload failed', cancel: null });
        });
    },
    [coordinator, updateEntry, refresh],
  );

  const addPhoto = useCallback(
    (picked: PickedPhoto) => {
      const localId = nextLocalId();
      const entry: LocalPhotoEntry = {
        localId,
        path: picked.path,
        status: 'pending',
        progress: 0,
        error: null,
        uploadedPhotoId: null,
        cancel: null,
      };
      setLocalQueue((q) => [...q, entry]);
      startUpload(entry);
    },
    [startUpload],
  );

  const onCameraCapture = useCallback((photos: PickedPhoto[]) => {
    for (const p of photos) {
      addPhoto(p);
    }
  }, [addPhoto]);

  const onTakePhoto = useCallback(async () => {
    setPickerError(null);
    setCameraModalVisible(true);
    try {
      const picked = await takePhoto();
      if (picked) addPhoto(picked);
    } catch (err) {
      setPickerError(err instanceof PhotoTooLargeError ? err.message : (err as Error).message);
    }
  }, [addPhoto]);

  const onChoosePhotos = useCallback(async () => {
    setPickerError(null);
    try {
      const picked = await choosePhotos(remaining);
      for (const p of picked) addPhoto(p);
    } catch (err) {
      setPickerError(err instanceof PhotoTooLargeError ? err.message : (err as Error).message);
    }
  }, [addPhoto, remaining]);

  const retryUpload = useCallback(
    (entry: LocalPhotoEntry) => {
      startUpload(entry);
    },
    [startUpload],
  );

  const removeLocalEntry = useCallback(
    async (entry: LocalPhotoEntry) => {
      entry.cancel?.();
      setLocalQueue((q) => q.filter((e) => e.localId !== entry.localId));
      await cleanupTemp([entry.path]);
    },
    [],
  );

  const orderedServerPhotos = useMemo(() => [...serverPhotos].sort((a, b) => a.position - b.position), [serverPhotos]);

  const removeServerPhoto = useCallback(
    async (photoId: string) => {
      try {
        await coordinator.enqueue({ kind: 'delete', photoId });
        refresh();
      } catch (err) {
        // A failed delete (including a conflict rejection) must surface
        // visibly — the grid otherwise just silently doesn't change,
        // indistinguishable from the request never having been sent.
        setPickerError((err as Error).message ?? 'Could not remove this photo');
      }
    },
    [coordinator, refresh],
  );

  const movePhoto = useCallback(
    async (photoId: string, direction: -1 | 1) => {
      // Swap against the same sorted order the grid renders
      // (`orderedServerPhotos`), not the unsorted `serverPhotos` — the API
      // always returns photos pre-ordered today so this is latent, but the
      // component's own defensive sort above implies it doesn't trust that,
      // and swapping against the wrong order silently sends the wrong
      // desired sequence to the server if that assumption ever breaks.
      const ids = orderedServerPhotos.map((p) => p.id);
      const index = ids.indexOf(photoId);
      const swapWith = index + direction;
      if (index < 0 || swapWith < 0 || swapWith >= ids.length) return;
      const reordered = [...ids];
      [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];
      try {
        await coordinator.enqueue({ kind: 'order', photoIds: reordered });
        refresh();
      } catch (err) {
        setPickerError((err as Error).message ?? 'Could not reorder photos');
      }
    },
    [coordinator, orderedServerPhotos, refresh],
  );

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="images-outline" size={16} color={theme.colors.primary} />
          <Text style={[styles.titleText, { color: theme.colors.text }]}>Product Photos</Text>
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.countText, { color: theme.colors.textMuted }]}>
          {totalCount}/{MAX_PHOTOS} photos{remaining === 0 ? ' — limit reached' : ''}
        </Text>
      </View>

      <View style={styles.gridRow}>
        {orderedServerPhotos.map((photo, index) => (
          <View
            key={photo.id}
            testID={`photo-${photo.id}`}
            style={[
              styles.photoCard,
              {
                borderColor: index === 0 ? theme.colors.primary : '#DCDED9',
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.bgElevated,
              },
            ]}
          >
            {photo.retained ? (
              <Image
                testID={`photo-${photo.id}-image`}
                source={{ uri: photo.thumbnailUrl, cache: 'force-cache' }}
                accessibilityIgnoresInvertColors
                style={styles.photoImage}
                fadeDuration={100}
              />
            ) : (
              <PrivateProductImage
                testID={`photo-${photo.id}-image`}
                target={target}
                photoId={photo.id}
                variant="thumb"
                style={styles.photoImage}
              />
            )}

            {/* Floating Top-Right Remove Button with 48px Touch Target */}
            <Pressable
              testID={`photo-${photo.id}-remove`}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              disabled={blockedByConflict}
              onPress={() => removeServerPhoto(photo.id)}
              style={styles.removeBtn}
            >
              <View style={styles.removeBadge}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </View>
            </Pressable>

            {/* Floating Bottom Overlay: Cover Badge & Reorder Controls */}
            <View style={styles.bottomOverlay}>
              {index === 0 ? (
                <View style={[styles.coverBadge, { backgroundColor: theme.colors.primary }]}>
                  <Text testID={`photo-${photo.id}-cover`} style={styles.coverText}>
                    Cover
                  </Text>
                </View>
              ) : (
                <View />
              )}

              <View style={styles.reorderGroup}>
                <Pressable
                  testID={`photo-${photo.id}-move-left`}
                  accessibilityRole="button"
                  accessibilityLabel={`Move photo ${index + 1} earlier`}
                  disabled={index === 0 || hasUnsettled || blockedByConflict}
                  onPress={() => movePhoto(photo.id, -1)}
                  style={[styles.reorderBtn, { opacity: index === 0 ? 0.3 : 1 }]}
                >
                  <View style={styles.reorderBadge}>
                    <Ionicons name="chevron-back" size={12} color="#FFFFFF" />
                  </View>
                </Pressable>
                <Pressable
                  testID={`photo-${photo.id}-move-right`}
                  accessibilityRole="button"
                  accessibilityLabel={`Move photo ${index + 1} later`}
                  disabled={index === orderedServerPhotos.length - 1 || hasUnsettled || blockedByConflict}
                  onPress={() => movePhoto(photo.id, 1)}
                  style={[
                    styles.reorderBtn,
                    { opacity: index === orderedServerPhotos.length - 1 ? 0.3 : 1 },
                  ]}
                >
                  <View style={styles.reorderBadge}>
                    <Ionicons name="chevron-forward" size={12} color="#FFFFFF" />
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        {visibleLocalQueue.map((entry) => (
          <View
            key={entry.localId}
            testID={`local-photo-${entry.localId}`}
            style={[
              styles.photoCard,
              {
                borderColor: theme.colors.primary,
                borderRadius: theme.radii.md,
                backgroundColor: theme.colors.bgElevated,
              },
            ]}
          >
            <Image
              source={{ uri: entry.path }}
              accessibilityIgnoresInvertColors
              style={[styles.photoImage, { opacity: entry.status === 'uploaded' ? 1 : 0.6 }]}
            />

            {entry.status !== 'uploaded' ? (
              <Pressable
                testID={`local-photo-${entry.localId}-cancel`}
                accessibilityRole="button"
                accessibilityLabel="Cancel upload"
                onPress={() => removeLocalEntry(entry)}
                style={styles.removeBtn}
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            ) : null}

            {entry.status === 'uploading' ? (
              <View style={styles.uploadingOverlay}>
                <Text testID={`local-photo-${entry.localId}-progress`} style={styles.uploadingProgressText}>
                  {Math.round(entry.progress * 100)}%
                </Text>
              </View>
            ) : null}

            {entry.status === 'failed' ? (
              <View style={styles.failedOverlay}>
                <Text style={styles.failedErrorText} numberOfLines={1}>
                  {entry.error}
                </Text>
                <Pressable
                  testID={`local-photo-${entry.localId}-retry`}
                  accessibilityRole="button"
                  accessibilityLabel="Retry upload"
                  onPress={() => retryUpload(entry)}
                  style={[styles.retryBtn, { backgroundColor: theme.colors.primary }]}
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {pickerError ? <Text style={[styles.pickerErrorText, { color: theme.colors.danger }]}>{pickerError}</Text> : null}

      <View style={styles.actionBtnsRow}>
        <Button testID="photo-take" label="Take photo" icon="camera" variant="outline" disabled={remaining === 0 || blockedByConflict} onPress={onTakePhoto} />
        <Button testID="photo-choose" label="Choose photos" icon="images" variant="outline" disabled={remaining === 0 || blockedByConflict} onPress={onChoosePhotos} />
      </View>
      <MultiPhotoCameraModal
        visible={cameraModalVisible}
        maxPhotos={remaining}
        title="Product Photos"
        onCapture={onCameraCapture}
        onClose={() => setCameraModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E2DE',
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: 98,
    height: 98,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  removeBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  bottomOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  removeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(44, 44, 40, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(44, 44, 40, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  reorderGroup: {
    flexDirection: 'row',
    gap: 3,
  },
  reorderBtn: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  uploadingProgressText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  failedOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    alignItems: 'center',
    gap: 2,
  },
  failedErrorText: {
    color: '#E0442A',
    fontSize: 9,
    fontWeight: '700',
  },
  retryBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  pickerErrorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
});
