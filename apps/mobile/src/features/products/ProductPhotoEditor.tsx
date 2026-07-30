import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { CoordinatedEntity, DraftMutationCoordinator } from './draft-mutation-coordinator';
import { takePhoto, choosePhotos, cleanupTemp, PhotoTooLargeError, type PickedPhoto } from './photo-picker-adapter';
import { PrivateProductImage, type PrivateMediaTarget } from '../../api/product-private-image';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';

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

  // The coordinator owns the authoritative server photo list; this
  // component re-renders whenever it changes by re-reading getState()
  // after every mutation completes (no external store/subscription needed
  // for a component with this narrow a lifetime).
  const serverPhotos = coordinator.getState().photos;
  const uploadedLocalCount = localQueue.filter((e) => e.status !== 'failed' && e.uploadedPhotoId === null).length;
  const totalCount = serverPhotos.length + uploadedLocalCount;
  const remaining = Math.max(0, MAX_PHOTOS - totalCount);
  const hasUnsettled = localQueue.some((e) => e.status === 'pending' || e.status === 'uploading');

  const refresh = useCallback(() => forceRerender((n) => n + 1), []);

  useEffect(() => {
    onUnsettledChange?.(hasUnsettled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasUnsettled]);

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

  const onTakePhoto = useCallback(async () => {
    setPickerError(null);
    try {
      const picked = await takePhoto();
      if (picked) addPhoto(picked); // null = user cancelled, silent per spec
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

  const removeServerPhoto = useCallback(
    async (photoId: string) => {
      await coordinator.enqueue({ kind: 'delete', photoId });
      refresh();
    },
    [coordinator, refresh],
  );

  const movePhoto = useCallback(
    async (photoId: string, direction: -1 | 1) => {
      const ids = serverPhotos.map((p) => p.id);
      const index = ids.indexOf(photoId);
      const swapWith = index + direction;
      if (index < 0 || swapWith < 0 || swapWith >= ids.length) return;
      const reordered = [...ids];
      [reordered[index], reordered[swapWith]] = [reordered[swapWith]!, reordered[index]!];
      await coordinator.enqueue({ kind: 'order', photoIds: reordered });
      refresh();
    },
    [coordinator, serverPhotos, refresh],
  );

  const orderedServerPhotos = useMemo(() => [...serverPhotos].sort((a, b) => a.position - b.position), [serverPhotos]);

  return (
    <View style={{ gap: theme.spacing.md }}>
      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Photos</Text>
      <Text accessibilityLiveRegion="polite" style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {totalCount}/{MAX_PHOTOS} photos{remaining === 0 ? ' — limit reached' : ''}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {orderedServerPhotos.map((photo, index) => (
          <View key={photo.id} testID={`photo-${photo.id}`} style={{ width: 96, gap: 4 }}>
            {photo.retained ? (
              // A retained edit photo's bytes are already public (its
              // `thumbnailUrl` is a real absolute URL) — the edit's private
              // media route 404s for retained entries by server design, so
              // this must never go through PrivateProductImage.
              <Image
                testID={`photo-${photo.id}-image`}
                source={{ uri: photo.thumbnailUrl }}
                accessibilityIgnoresInvertColors
                style={{ width: 96, height: 96, borderRadius: theme.radii.md }}
              />
            ) : (
              <PrivateProductImage
                testID={`photo-${photo.id}-image`}
                target={target}
                photoId={photo.id}
                variant="thumb"
                style={{ width: 96, height: 96, borderRadius: theme.radii.md }}
              />
            )}
            {index === 0 ? (
              <Text testID={`photo-${photo.id}-cover`} style={{ color: theme.colors.primary, fontSize: 11, fontWeight: '700' }}>
                Cover
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Pressable
                testID={`photo-${photo.id}-move-left`}
                accessibilityRole="button"
                accessibilityLabel={`Move photo ${index + 1} earlier`}
                disabled={index === 0 || hasUnsettled}
                onPress={() => movePhoto(photo.id, -1)}
                style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="chevron-back" size={18} color={index === 0 ? theme.colors.border : theme.colors.primary} />
              </Pressable>
              <Pressable
                testID={`photo-${photo.id}-move-right`}
                accessibilityRole="button"
                accessibilityLabel={`Move photo ${index + 1} later`}
                disabled={index === orderedServerPhotos.length - 1 || hasUnsettled}
                onPress={() => movePhoto(photo.id, 1)}
                style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={index === orderedServerPhotos.length - 1 ? theme.colors.border : theme.colors.primary}
                />
              </Pressable>
            </View>
            <Pressable
              testID={`photo-${photo.id}-remove`}
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${index + 1}`}
              onPress={() => removeServerPhoto(photo.id)}
              style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: theme.colors.danger, fontSize: 12 }}>Remove</Text>
            </Pressable>
          </View>
        ))}

        {localQueue.map((entry) => (
          <View key={entry.localId} testID={`local-photo-${entry.localId}`} style={{ width: 96, gap: 4 }}>
            <Image
              source={{ uri: entry.path }}
              accessibilityIgnoresInvertColors
              style={{ width: 96, height: 96, borderRadius: theme.radii.md, opacity: entry.status === 'uploaded' ? 1 : 0.6 }}
            />
            {entry.status === 'uploading' ? (
              <Text testID={`local-photo-${entry.localId}-progress`} style={{ color: theme.colors.textMuted, fontSize: 11 }}>
                {Math.round(entry.progress * 100)}%
              </Text>
            ) : null}
            {entry.status === 'failed' ? (
              <>
                <Text style={{ color: theme.colors.danger, fontSize: 11 }}>{entry.error}</Text>
                <Pressable
                  testID={`local-photo-${entry.localId}-retry`}
                  accessibilityRole="button"
                  accessibilityLabel="Retry upload"
                  onPress={() => retryUpload(entry)}
                  style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: theme.colors.primary, fontSize: 12 }}>Retry</Text>
                </Pressable>
              </>
            ) : null}
            {entry.status !== 'uploaded' ? (
              <Pressable
                testID={`local-photo-${entry.localId}-cancel`}
                accessibilityRole="button"
                accessibilityLabel="Cancel upload"
                onPress={() => removeLocalEntry(entry)}
                style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: theme.colors.danger, fontSize: 12 }}>Cancel</Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {pickerError ? <Text style={{ color: theme.colors.danger }}>{pickerError}</Text> : null}

      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <Button testID="photo-take" label="Take photo" icon="camera" variant="outline" disabled={remaining === 0} onPress={onTakePhoto} />
        <Button testID="photo-choose" label="Choose photos" icon="images" variant="outline" disabled={remaining === 0} onPress={onChoosePhotos} />
      </View>
    </View>
  );
}
