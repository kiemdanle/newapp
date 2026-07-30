import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../theme/store';
import { useSessionStore } from '../../auth/session-store';
import { queueFetch, jsonResponse } from '../../../tests/mocks/fetch';
import { __reset } from '../../../tests/mocks/react-native-keychain';
import { ProductPhotoEditor, resetLocalPhotoIdCounterForTests } from './ProductPhotoEditor';
import type { CoordinatedEntity, DraftMutationCoordinator } from './draft-mutation-coordinator';
import { takePhoto, choosePhotos, cleanupTemp, PhotoTooLargeError } from './photo-picker-adapter';

// react-native-image-crop-picker's own native module isn't registered in
// this Jest environment (same reason photo-picker-adapter.test.ts mocks it
// directly) — stub it so importing photo-picker-adapter.ts (for the real
// `PhotoTooLargeError` class this file needs for an `instanceof` check)
// doesn't crash on module load.
jest.mock('react-native-image-crop-picker', () => ({
  __esModule: true,
  default: { openCamera: jest.fn(), openPicker: jest.fn(), cleanSingle: jest.fn() },
}));
jest.mock('./photo-picker-adapter', () => {
  const actual = jest.requireActual('./photo-picker-adapter');
  return {
    ...actual,
    takePhoto: jest.fn(),
    choosePhotos: jest.fn(),
    cleanupTemp: jest.fn().mockResolvedValue(undefined),
  };
});

const mockTakePhoto = takePhoto as jest.MockedFunction<typeof takePhoto>;
const mockChoosePhotos = choosePhotos as jest.MockedFunction<typeof choosePhotos>;
const mockCleanupTemp = cleanupTemp as jest.MockedFunction<typeof cleanupTemp>;

interface Entity extends CoordinatedEntity {}

function entity(photos: Entity['photos'] = []): Entity {
  return { id: 'p1', version: 1, name: 'X', description: null, brand: null, category: null, photos };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A hand-rolled fake — this file tests ProductPhotoEditor's own logic, not
 * the coordinator (already exhaustively covered in
 * draft-mutation-coordinator.test.ts), so a minimal controllable double is
 * clearer than wiring the real coordinator through a second fake adapter. */
function makeCoordinator(initial: Entity, opts: { hasConflict?: boolean } = {}) {
  let state = initial;
  let conflicted = opts.hasConflict ?? false;
  const enqueue = jest.fn();
  const coordinator: DraftMutationCoordinator<Entity> = {
    enqueue,
    flushMetadata: jest.fn().mockResolvedValue(state),
    reconcileConflict: jest.fn().mockResolvedValue(state),
    getState: () => state,
    hasConflict: () => conflicted,
    onConflict: jest.fn(() => () => undefined),
  };
  return {
    coordinator,
    enqueue,
    setState: (next: Entity) => {
      state = next;
    },
    setConflicted: (next: boolean) => {
      conflicted = next;
    },
  };
}

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('<ProductPhotoEditor />', () => {
  beforeEach(async () => {
    __reset();
    jest.clearAllMocks();
    resetLocalPhotoIdCounterForTests();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
    useSessionStore.setState({ user: { id: 'user-1' } as never, accessToken: 'a', refreshToken: 'r', hydrated: true, pendingAuth: null });
  });

  it('shows the current count and existing server photos with the first as cover', async () => {
    const { coordinator } = makeCoordinator(
      entity([
        { id: 'photo-1', position: 0, thumbnailUrl: '/x' },
        { id: 'photo-2', position: 1, thumbnailUrl: '/y' },
      ]),
    );
    queueFetch(jsonResponse('bytes'), jsonResponse('bytes'));
    const { getByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));

    expect(getByTestId('photo-photo-1-cover')).toBeTruthy();
    await waitFor(() => expect(getByTestId('photo-photo-1')).toBeTruthy());
  });

  it('adds a photo via camera, shows upload progress, then marks it uploaded and cleans up the temp file', async () => {
    const { coordinator, enqueue, setState } = makeCoordinator(entity());
    mockTakePhoto.mockResolvedValue({ path: '/tmp/a.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 100 });
    const gate = deferred<Entity>();
    enqueue.mockImplementation((op: { kind: string; onProgress?: (r: number) => void }) => {
      if (op.kind === 'upload') {
        op.onProgress?.(0.5);
        return gate.promise;
      }
      return Promise.resolve(coordinator.getState());
    });

    const { getByTestId, findByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    fireEvent.press(getByTestId('photo-take'));

    const localEntry = await findByTestId('local-photo-local-1');
    expect(localEntry).toBeTruthy();
    const progressNode = await findByTestId('local-photo-local-1-progress');
    expect(progressNode.props.children).toEqual([50, '%']);

    const updated = entity([{ id: 'photo-new', position: 0, thumbnailUrl: '/new' }]);
    setState(updated);
    gate.resolve(updated);

    await waitFor(() => expect(mockCleanupTemp).toHaveBeenCalledWith(['/tmp/a.jpg']));
  });

  it('shows a picker cap message and disables Add controls once 5 photos are reached', async () => {
    const photos = Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, position: i, thumbnailUrl: '/x' }));
    const { coordinator } = makeCoordinator(entity(photos));
    queueFetch(...photos.map(() => jsonResponse('bytes')));

    const { getByTestId, getByText } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));

    expect(getByText('5/5 photos — limit reached')).toBeTruthy();
    expect(getByTestId('photo-take').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('photo-choose').props.accessibilityState.disabled).toBe(true);
  });

  it('a failed upload shows a Retry action, which re-attempts the same local file', async () => {
    const { coordinator, enqueue } = makeCoordinator(entity());
    mockTakePhoto.mockResolvedValue({ path: '/tmp/a.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 100 });
    enqueue.mockRejectedValueOnce(new Error('network down'));
    enqueue.mockResolvedValueOnce(entity([{ id: 'photo-1', position: 0, thumbnailUrl: '/x' }]));

    const { getByTestId, findByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    fireEvent.press(getByTestId('photo-take'));

    const retryButton = await findByTestId('local-photo-local-1-retry');
    expect(retryButton).toBeTruthy();

    fireEvent.press(retryButton);
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(2));
  });

  it('cancelling an in-flight upload aborts the transport and cleans up the temp file', async () => {
    const { coordinator, enqueue } = makeCoordinator(entity());
    mockTakePhoto.mockResolvedValue({ path: '/tmp/a.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 100 });
    const cancel = jest.fn();
    const gate = deferred<Entity>();
    enqueue.mockImplementation((op: { kind: string; onHandle?: (h: { cancel: () => void }) => void }) => {
      if (op.kind === 'upload') {
        op.onHandle?.({ cancel });
        return gate.promise;
      }
      return Promise.resolve(coordinator.getState());
    });

    const { getByTestId, findByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    fireEvent.press(getByTestId('photo-take'));
    const cancelButton = await findByTestId('local-photo-local-1-cancel');

    fireEvent.press(cancelButton);

    expect(cancel).toHaveBeenCalled();
    await waitFor(() => expect(mockCleanupTemp).toHaveBeenCalledWith(['/tmp/a.jpg']));
  });

  it('choosing from the gallery passes the exact remaining slot count and queues one entry per picked photo', async () => {
    const { coordinator, enqueue, setState } = makeCoordinator(entity([{ id: 'photo-1', position: 0, thumbnailUrl: '/x' }]));
    queueFetch(jsonResponse('bytes'));
    mockChoosePhotos.mockResolvedValue([
      { path: '/tmp/b.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 100 },
      { path: '/tmp/c.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 100 },
    ]);
    let nextPhotoId = 0;
    enqueue.mockImplementation(async (op: { kind: string }) => {
      if (op.kind === 'upload') {
        nextPhotoId += 1;
        const next = entity([...coordinator.getState().photos, { id: `new-${nextPhotoId}`, position: nextPhotoId, thumbnailUrl: '/new' }]);
        setState(next);
        return next;
      }
      return coordinator.getState();
    });

    const { getByTestId, findByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    await waitFor(() => expect(getByTestId('photo-photo-1')).toBeTruthy());

    fireEvent.press(getByTestId('photo-choose'));

    // One existing server photo, cap 5 → 4 remaining slots offered to the picker.
    expect(mockChoosePhotos).toHaveBeenCalledWith(4);
    // Both picked photos queue and upload (a confirmed-uploaded local entry
    // is dropped from render the moment the coordinator confirms it — this
    // mock's own `enqueue` resolves synchronously, so by the time these
    // assertions run the local entries have already been promoted to their
    // server tiles).
    expect(await findByTestId('photo-new-1')).toBeTruthy();
    expect(await findByTestId('photo-new-2')).toBeTruthy();
    await waitFor(() => expect(enqueue).toHaveBeenCalledTimes(2));
  });

  it('a cancelled picker (null result) is silent — no queue entry, no error shown', async () => {
    const { coordinator } = makeCoordinator(entity());
    mockTakePhoto.mockResolvedValue(null);

    const { getByTestId, queryByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    fireEvent.press(getByTestId('photo-take'));

    await waitFor(() => expect(mockTakePhoto).toHaveBeenCalledTimes(1));
    expect(queryByTestId(/local-photo-/)).toBeNull();
  });

  it('surfaces a PhotoTooLargeError from the picker as a visible message', async () => {
    const { coordinator } = makeCoordinator(entity());
    mockTakePhoto.mockRejectedValue(new PhotoTooLargeError(12 * 1024 * 1024));

    const { getByTestId, findByText } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    fireEvent.press(getByTestId('photo-take'));

    expect(await findByText(/12\.0 MB/)).toBeTruthy();
  });

  it('removing an uploaded server photo calls delete and refreshes the grid', async () => {
    const { coordinator, enqueue, setState } = makeCoordinator(
      entity([{ id: 'photo-1', position: 0, thumbnailUrl: '/x' }]),
    );
    queueFetch(jsonResponse('bytes'));
    enqueue.mockImplementation(async (op: { kind: string; photoId?: string }) => {
      if (op.kind === 'delete') {
        const next = entity([]);
        setState(next);
        return next;
      }
      return coordinator.getState();
    });

    const { getByTestId, queryByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    await waitFor(() => expect(getByTestId('photo-photo-1')).toBeTruthy());

    fireEvent.press(getByTestId('photo-photo-1-remove'));

    await waitFor(() => expect(enqueue).toHaveBeenCalledWith({ kind: 'delete', photoId: 'photo-1' }));
    await waitFor(() => expect(queryByTestId('photo-photo-1')).toBeNull());
  });

  it('moving a photo right swaps its order and re-sends the full desired order', async () => {
    const { coordinator, enqueue, setState } = makeCoordinator(
      entity([
        { id: 'photo-1', position: 0, thumbnailUrl: '/x' },
        { id: 'photo-2', position: 1, thumbnailUrl: '/y' },
      ]),
    );
    queueFetch(jsonResponse('bytes'), jsonResponse('bytes'), jsonResponse('bytes'), jsonResponse('bytes'));
    enqueue.mockImplementation(async (op: { kind: string; photoIds?: string[] }) => {
      if (op.kind === 'order') {
        const next = entity([
          { id: 'photo-2', position: 0, thumbnailUrl: '/y' },
          { id: 'photo-1', position: 1, thumbnailUrl: '/x' },
        ]);
        setState(next);
        return next;
      }
      return coordinator.getState();
    });

    const { getByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    await waitFor(() => expect(getByTestId('photo-photo-1')).toBeTruthy());

    fireEvent.press(getByTestId('photo-photo-1-move-right'));

    await waitFor(() => expect(enqueue).toHaveBeenCalledWith({ kind: 'order', photoIds: ['photo-2', 'photo-1'] }));
  });

  it('every photo control is disabled while the coordinator has an unresolved conflict', async () => {
    const { coordinator } = makeCoordinator(entity([{ id: 'photo-1', position: 0, thumbnailUrl: '/x' }]), { hasConflict: true });
    queueFetch(jsonResponse('bytes'));

    const { getByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    await waitFor(() => expect(getByTestId('photo-photo-1')).toBeTruthy());

    for (const testId of ['photo-take', 'photo-choose', 'photo-photo-1-move-left', 'photo-photo-1-move-right', 'photo-photo-1-remove']) {
      expect(getByTestId(testId).props.accessibilityState?.disabled ?? getByTestId(testId).props.disabled).toBe(true);
    }
  });

  it('a failed delete surfaces a visible error instead of silently leaving the grid unchanged', async () => {
    const { coordinator, enqueue } = makeCoordinator(entity([{ id: 'photo-1', position: 0, thumbnailUrl: '/x' }]));
    queueFetch(jsonResponse('bytes'));
    enqueue.mockRejectedValue(new Error('coordinator_conflict'));

    const { getByTestId, findByText } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    await waitFor(() => expect(getByTestId('photo-photo-1')).toBeTruthy());

    fireEvent.press(getByTestId('photo-photo-1-remove'));

    expect(await findByText('coordinator_conflict')).toBeTruthy();
  });

  it('a failed reorder surfaces a visible error instead of silently leaving the grid unchanged', async () => {
    const { coordinator, enqueue } = makeCoordinator(
      entity([
        { id: 'photo-1', position: 0, thumbnailUrl: '/x' },
        { id: 'photo-2', position: 1, thumbnailUrl: '/y' },
      ]),
    );
    queueFetch(jsonResponse('bytes'), jsonResponse('bytes'));
    enqueue.mockRejectedValue(new Error('coordinator_conflict'));

    const { getByTestId, findByText } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    await waitFor(() => expect(getByTestId('photo-photo-1')).toBeTruthy());

    fireEvent.press(getByTestId('photo-photo-1-move-right'));

    expect(await findByText('coordinator_conflict')).toBeTruthy();
  });

  it('a retained edit photo renders its already-public thumbnailUrl directly, never through the authenticated private fetch', async () => {
    const { coordinator } = makeCoordinator(
      entity([{ id: 'photo-1', position: 0, thumbnailUrl: 'https://cdn.example.com/pub/photo-1-thumb.webp', retained: true }]),
    );
    // No queueFetch response staged for a private-image request — if the
    // component wrongly routed this through PrivateProductImage, the
    // unmocked fetch call would reject/hang and the image would never render.
    const { getByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'product_edit', editId: 'edit-1' }} coordinator={coordinator} />));

    const image = await waitFor(() => getByTestId('photo-photo-1-image'));
    expect(image.props.source).toEqual({ uri: 'https://cdn.example.com/pub/photo-1-thumb.webp' });
  });

  it('reports unsettled state while an upload is pending/uploading and clears it once settled', async () => {
    const { coordinator } = makeCoordinator(entity());
    mockTakePhoto.mockResolvedValue({ path: '/tmp/a.jpg', width: 800, height: 600, mime: 'image/jpeg', size: 100 });
    const gate = deferred<Entity>();
    coordinator.enqueue = jest.fn().mockImplementation((op: { kind: string }) => {
      if (op.kind === 'upload') return gate.promise;
      return Promise.resolve(coordinator.getState());
    });
    const onUnsettledChange = jest.fn();

    const { getByTestId } = render(
      wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} onUnsettledChange={onUnsettledChange} />),
    );
    expect(onUnsettledChange).toHaveBeenLastCalledWith(false);

    fireEvent.press(getByTestId('photo-take'));
    await waitFor(() => expect(onUnsettledChange).toHaveBeenLastCalledWith(true));

    gate.resolve(entity([{ id: 'new-1', position: 0, thumbnailUrl: '/new' }]));
    await waitFor(() => expect(onUnsettledChange).toHaveBeenLastCalledWith(false));
  });

  it('every interactive control meets the 48px touch-target minimum', async () => {
    const { coordinator } = makeCoordinator(entity([{ id: 'photo-1', position: 0, thumbnailUrl: '/x' }]));
    queueFetch(jsonResponse('bytes'));
    const { getByTestId } = render(wrap(<ProductPhotoEditor target={{ kind: 'draft', productId: 'p1' }} coordinator={coordinator} />));
    await waitFor(() => expect(getByTestId('photo-photo-1')).toBeTruthy());

    for (const testId of ['photo-photo-1-move-left', 'photo-photo-1-move-right', 'photo-photo-1-remove']) {
      const node = getByTestId(testId);
      const flatStyle = Array.isArray(node.props.style) ? Object.assign({}, ...node.props.style) : node.props.style;
      expect(flatStyle.minHeight).toBeGreaterThanOrEqual(48);
    }
  });
});
