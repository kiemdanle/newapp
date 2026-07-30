import {
  createDraftMutationCoordinator,
  type CoordinatedEntity,
  type CoordinatorAdapter,
  type MetadataFields,
} from './draft-mutation-coordinator';
import { ApiError } from '../../api/errors';

interface Entity extends CoordinatedEntity {
  updatedAt: string;
}

function entity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: 'p1',
    version: 1,
    name: 'Frozen peas',
    description: null,
    brand: null,
    category: null,
    photos: [],
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
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

function makeAdapter(): jest.Mocked<CoordinatorAdapter<Entity>> {
  return {
    patchMetadata: jest.fn(),
    refetch: jest.fn(),
    uploadPhoto: jest.fn(),
    deletePhoto: jest.fn(),
    orderPhotos: jest.fn(),
  };
}

describe('draft-mutation-coordinator', () => {
  it('serializes two metadata flushes: the second request is not issued until the first resolves', async () => {
    const adapter = makeAdapter();
    const first = deferred<Entity>();
    adapter.patchMetadata.mockReturnValueOnce(first.promise);
    adapter.patchMetadata.mockResolvedValueOnce(entity({ version: 3, name: 'Second' }));

    const coordinator = createDraftMutationCoordinator(adapter, entity());

    const p1 = coordinator.enqueue({ kind: 'metadata', fields: { name: 'First' } });
    // Let the auto-scheduled flush actually issue its request (it's queued
    // onto the internal chain, not synchronous with enqueue()).
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(adapter.patchMetadata).toHaveBeenCalledTimes(1);

    const p2 = coordinator.enqueue({ kind: 'metadata', fields: { name: 'Second' } });
    // The second flush must not have been issued yet — still waiting on the first.
    await Promise.resolve();
    await Promise.resolve();
    expect(adapter.patchMetadata).toHaveBeenCalledTimes(1);

    first.resolve(entity({ version: 2, name: 'First' }));
    await p1;
    await p2;

    expect(adapter.patchMetadata).toHaveBeenCalledTimes(2);
    expect(adapter.patchMetadata.mock.calls[1]).toEqual(['p1', 2, { name: 'Second' }]);
  });

  it('applies results in enqueue order even when an earlier call would resolve later (deterministic serialization, not response-arrival order)', async () => {
    const adapter = makeAdapter();
    const slow = deferred<Entity>();
    const order: string[] = [];
    adapter.patchMetadata.mockImplementationOnce(async () => {
      order.push('start-1');
      const v = await slow.promise;
      order.push('end-1');
      return v;
    });
    adapter.patchMetadata.mockImplementationOnce(async () => {
      order.push('start-2');
      order.push('end-2');
      return entity({ version: 3, name: 'B' });
    });

    const coordinator = createDraftMutationCoordinator(adapter, entity());
    const p1 = coordinator.enqueue({ kind: 'metadata', fields: { name: 'A' } });
    await Promise.resolve();
    await Promise.resolve();
    const p2 = coordinator.enqueue({ kind: 'metadata', fields: { name: 'B' } });

    // Even though call 2's own work would finish "faster", it must not even
    // start until call 1 has fully resolved.
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual(['start-1']);

    slow.resolve(entity({ version: 2, name: 'A' }));
    await p1;
    await p2;

    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('coalesces metadata edits queued before the first flush executes into a single request', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockResolvedValue(entity({ version: 2, name: 'C', brand: 'Acme' }));
    const coordinator = createDraftMutationCoordinator(adapter, entity());

    const p1 = coordinator.enqueue({ kind: 'metadata', fields: { name: 'A' } });
    const p2 = coordinator.enqueue({ kind: 'metadata', fields: { name: 'B' } });
    const p3 = coordinator.enqueue({ kind: 'metadata', fields: { name: 'C', brand: 'Acme' } });

    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(adapter.patchMetadata).toHaveBeenCalledTimes(1);
    expect(adapter.patchMetadata).toHaveBeenCalledWith('p1', 1, { name: 'C', brand: 'Acme' });
    expect(r1).toEqual(r2);
    expect(r2).toEqual(r3);
  });

  it('flushes pending metadata before an upload runs', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockResolvedValue(entity({ version: 2, name: 'Edited' }));
    adapter.uploadPhoto.mockReturnValue({
      promise: Promise.resolve(entity({ version: 3, name: 'Edited' })),
      cancel: jest.fn(),
      onProgress: jest.fn(() => () => undefined),
    });
    const coordinator = createDraftMutationCoordinator(adapter, entity());

    coordinator.enqueue({ kind: 'metadata', fields: { name: 'Edited' } });
    const result = await coordinator.enqueue({ kind: 'upload', photo: { path: '/tmp/a.jpg', mime: 'image/jpeg' } });

    expect(adapter.patchMetadata).toHaveBeenCalledTimes(1);
    expect(adapter.uploadPhoto).toHaveBeenCalledTimes(1);
    expect(result.version).toBe(3);
  });

  it('flushes pending metadata before a delete and an order operation too', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockResolvedValue(entity({ version: 2 }));
    adapter.deletePhoto.mockResolvedValue(entity({ version: 3 }));
    adapter.orderPhotos.mockResolvedValue(entity({ version: 4 }));
    const coordinator = createDraftMutationCoordinator(adapter, entity());

    coordinator.enqueue({ kind: 'metadata', fields: { name: 'X' } });
    await coordinator.enqueue({ kind: 'delete', photoId: 'photo-1' });
    expect(adapter.patchMetadata).toHaveBeenCalledTimes(1);
    expect(adapter.deletePhoto).toHaveBeenCalledWith('photo-1');

    coordinator.enqueue({ kind: 'metadata', fields: { name: 'Y' } });
    await coordinator.enqueue({ kind: 'order', photoIds: ['a', 'b'] });
    expect(adapter.patchMetadata).toHaveBeenCalledTimes(2);
    expect(adapter.orderPhotos).toHaveBeenCalledWith(['a', 'b']);
  });

  it('getState() always reflects dirty local fields merged over the last known server state', async () => {
    const adapter = makeAdapter();
    const gate = deferred<Entity>();
    adapter.patchMetadata.mockReturnValue(gate.promise);
    const coordinator = createDraftMutationCoordinator(adapter, entity({ name: 'Original', brand: 'Old brand' }));

    void coordinator.enqueue({ kind: 'metadata', fields: { name: 'Typed locally' } });
    await Promise.resolve();

    const state = coordinator.getState();
    expect(state.name).toBe('Typed locally');
    expect(state.brand).toBe('Old brand'); // untouched field stays as known
    gate.resolve(entity({ version: 2, name: 'Typed locally', brand: 'Old brand' }));
  });

  it('a 409 version_conflict refetches, preserves the caller\'s dirty fields, and notifies conflict listeners', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockRejectedValue(
      new ApiError({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 5 }),
    );
    const serverEntity = entity({ version: 5, name: 'Someone else changed this', brand: 'Server brand' });
    adapter.refetch.mockResolvedValue(serverEntity);

    const coordinator = createDraftMutationCoordinator(adapter, entity());
    const onConflict = jest.fn();
    coordinator.onConflict(onConflict);

    // The enqueued promise deliberately stays pending through the conflict
    // window — it only settles once reconcileConflict() resolves it — so
    // this test observes state via the coordinator's own accessors instead
    // of awaiting that promise directly.
    const enqueuePromise = coordinator.enqueue({ kind: 'metadata', fields: { name: 'My local edit' } });
    await new Promise((r) => setImmediate(r));

    expect(coordinator.hasConflict()).toBe(true);
    expect(onConflict).toHaveBeenCalledWith(
      expect.objectContaining({ currentVersion: 5, pendingFields: { name: 'My local edit' } }),
    );
    // Dirty field survives the conflict; untouched field adopts the server's fresh value.
    const state = coordinator.getState();
    expect(state.name).toBe('My local edit');
    expect(state.brand).toBe('Server brand');

    // Clean up: resolve the still-pending promise via discard so this test
    // doesn't leave a dangling handle.
    await coordinator.reconcileConflict('discard-local');
    await enqueuePromise;
  });

  it('reconcileConflict("retry") re-sends the pending fields against the fresh version, and settles the original caller', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockRejectedValueOnce(
      new ApiError({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 5 }),
    );
    const serverEntity = entity({ version: 5, name: 'Server name' });
    adapter.refetch.mockResolvedValue(serverEntity);
    adapter.patchMetadata.mockResolvedValueOnce(entity({ version: 6, name: 'My local edit' }));

    const coordinator = createDraftMutationCoordinator(adapter, entity());
    const enqueuePromise = coordinator.enqueue({ kind: 'metadata', fields: { name: 'My local edit' } });
    await new Promise((r) => setImmediate(r));
    expect(coordinator.hasConflict()).toBe(true);

    const result = await coordinator.reconcileConflict('retry');
    // The original enqueue() caller (queued before the conflict was ever
    // known) must also resolve once the retry succeeds — no lost intent.
    const originalCallerResult = await enqueuePromise;

    expect(coordinator.hasConflict()).toBe(false);
    expect(adapter.patchMetadata).toHaveBeenLastCalledWith('p1', 5, { name: 'My local edit' });
    expect(result.version).toBe(6);
    expect(originalCallerResult.version).toBe(6);
  });

  it('reconcileConflict("discard-local") drops the dirty fields, adopts the server state, and settles the original caller', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockRejectedValueOnce(
      new ApiError({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 5 }),
    );
    const serverEntity = entity({ version: 5, name: 'Server name' });
    adapter.refetch.mockResolvedValue(serverEntity);

    const coordinator = createDraftMutationCoordinator(adapter, entity());
    const enqueuePromise = coordinator.enqueue({ kind: 'metadata', fields: { name: 'My local edit' } });
    await new Promise((r) => setImmediate(r));

    const result = await coordinator.reconcileConflict('discard-local');
    const originalCallerResult = await enqueuePromise;

    expect(coordinator.hasConflict()).toBe(false);
    expect(result.name).toBe('Server name');
    expect(originalCallerResult.name).toBe('Server name');
    expect(coordinator.getState().name).toBe('Server name');
    expect(adapter.patchMetadata).toHaveBeenCalledTimes(1); // no retry request issued
  });

  it('a non-conflict metadata error rejects the caller without entering a conflict state', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockRejectedValue(new ApiError({ code: 'validation', status: 400, title: 'bad' }));
    const coordinator = createDraftMutationCoordinator(adapter, entity());

    await expect(coordinator.enqueue({ kind: 'metadata', fields: { name: 'X' } })).rejects.toMatchObject({
      code: 'validation',
    });
    expect(coordinator.hasConflict()).toBe(false);
  });

  // The three tests below close the exact gap reviewer-p5 found: nothing in
  // this suite previously enqueued anything *during* an unresolved conflict
  // window (as opposed to only checking the conflict's own initial detection
  // and its eventual resolution).

  it('I2: reconcileConflict("retry") merges the pre-conflict snapshot with fields typed during the conflict window, never overwriting the newer edit', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockRejectedValueOnce(
      new ApiError({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 5 }),
    );
    const serverEntity = entity({ version: 5, name: 'Server name' });
    adapter.refetch.mockResolvedValue(serverEntity);
    adapter.patchMetadata.mockResolvedValueOnce(entity({ version: 6, name: 'A-newer', brand: 'Acme' }));

    const coordinator = createDraftMutationCoordinator(adapter, entity());
    const firstAttempt = coordinator.enqueue({ kind: 'metadata', fields: { name: 'A' } });
    await new Promise((r) => setImmediate(r));
    expect(coordinator.hasConflict()).toBe(true);

    // Typed *during* the conflict window, before it's reconciled — a
    // different field (`brand`) must survive the retry, and a same-key edit
    // (`name`) must win over the stale pre-conflict snapshot.
    const duringConflict = coordinator.enqueue({ kind: 'metadata', fields: { name: 'A-newer', brand: 'Acme' } });

    await coordinator.reconcileConflict('retry');
    await firstAttempt;
    await duringConflict;

    expect(adapter.patchMetadata).toHaveBeenLastCalledWith('p1', 5, { name: 'A-newer', brand: 'Acme' });
  });

  it('I2: the ConflictInfo handed to onConflict listeners is never retroactively mutated by a later successful retry', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockRejectedValueOnce(
      new ApiError({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 5 }),
    );
    adapter.refetch.mockResolvedValue(entity({ version: 5 }));
    adapter.patchMetadata.mockResolvedValueOnce(entity({ version: 6, name: 'A' }));

    const coordinator = createDraftMutationCoordinator(adapter, entity());
    const capturedPendingFields: MetadataFields[] = [];
    coordinator.onConflict((info) => capturedPendingFields.push(info.pendingFields));

    const enqueuePromise = coordinator.enqueue({ kind: 'metadata', fields: { name: 'A' } });
    await new Promise((r) => setImmediate(r));
    await coordinator.reconcileConflict('retry');
    await enqueuePromise;

    // The snapshot delivered to the listener while the conflict was open
    // must still read `{ name: 'A' }` after the retry has fully succeeded —
    // a reference-aliasing bug would let the retry's own success-path key
    // deletion mutate this same object down to `{}`.
    expect(capturedPendingFields).toEqual([{ name: 'A' }]);
  });

  it('M1: a metadata enqueue issued while a flush is in flight still settles once that flush conflicts and is reconciled', async () => {
    const adapter = makeAdapter();
    const inFlight = deferred<Entity>();
    adapter.patchMetadata.mockReturnValueOnce(inFlight.promise);
    const serverEntity = entity({ version: 5, name: 'Server name' });
    adapter.refetch.mockResolvedValue(serverEntity);
    adapter.patchMetadata.mockResolvedValueOnce(entity({ version: 6, name: 'B' }));

    const coordinator = createDraftMutationCoordinator(adapter, entity());
    const firstAttempt = coordinator.enqueue({ kind: 'metadata', fields: { name: 'A' } });
    await Promise.resolve();
    await Promise.resolve();
    expect(adapter.patchMetadata).toHaveBeenCalledTimes(1); // in flight, not yet resolved

    // Arrives while the first request is still awaiting its response —
    // before the pre-fix code's `pendingWaiters = waiters;` would have
    // discarded it.
    const duringFlush = coordinator.enqueue({ kind: 'metadata', fields: { name: 'B' } });

    inFlight.reject(new ApiError({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 5 }));
    await new Promise((r) => setImmediate(r));
    expect(coordinator.hasConflict()).toBe(true);

    await coordinator.reconcileConflict('retry');

    // Both callers must settle — neither promise may hang forever.
    await expect(firstAttempt).resolves.toMatchObject({ version: 6 });
    await expect(duringFlush).resolves.toMatchObject({ version: 6 });
  });

  it('I1: a non-metadata operation enqueued while a conflict is unresolved rejects and never reaches the adapter', async () => {
    const adapter = makeAdapter();
    adapter.patchMetadata.mockRejectedValueOnce(
      new ApiError({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 5 }),
    );
    adapter.refetch.mockResolvedValue(entity({ version: 5 }));

    const coordinator = createDraftMutationCoordinator(adapter, entity());
    void coordinator.enqueue({ kind: 'metadata', fields: { name: 'A' } });
    await new Promise((r) => setImmediate(r));
    expect(coordinator.hasConflict()).toBe(true);

    await expect(
      coordinator.enqueue({ kind: 'upload', photo: { path: '/tmp/a.jpg', mime: 'image/jpeg' } }),
    ).rejects.toMatchObject({ code: 'coordinator_conflict' });

    // Never a fake success: the adapter itself must never have been called.
    expect(adapter.uploadPhoto).not.toHaveBeenCalled();
  });
});
