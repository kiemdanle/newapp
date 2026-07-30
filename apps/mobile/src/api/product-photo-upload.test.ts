import { __reset } from '../../tests/mocks/react-native-keychain';
import { jsonResponse, problemResponse, queueFetch } from '../../tests/mocks/fetch';
import { FakeXMLHttpRequest, installFakeXhr } from '../../tests/mocks/xhr';
import { secureStore } from '../auth/secure-store';
import { uploadProductPhoto, deleteProductPhoto, reorderProductPhotos } from './product-photo-upload';
import { ApiError } from './errors';

// The upload adapter chains several async hops (secureStore.getAccessToken,
// each itself Keychain-backed and async) before creating the XHR. Rather
// than guess the exact microtask depth with repeated `await
// Promise.resolve()`, flush past it with a macrotask boundary — this waits
// for every currently-queued microtask to drain first, regardless of depth.
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('uploadProductPhoto', () => {
  beforeEach(() => {
    __reset();
    installFakeXhr();
  });

  it('POSTs a single-part multipart body with the bearer header to the draft photos route', async () => {
    await secureStore.setAccessToken('access-1');

    const handle = uploadProductPhoto({ kind: 'draft', productId: 'prod-1' }, { path: '/tmp/photo.jpg', mime: 'image/jpeg' });
    await flush();

    const xhr = FakeXMLHttpRequest.instances[0]!;
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe('http://localhost:4000/v1/products/prod-1/photos');
    expect(xhr.requestHeaders.Authorization).toBe('Bearer access-1');
    expect(xhr.sentBody).toBeInstanceOf(FormData);

    xhr.respond(201, { id: 'prod-1', name: 'X' });
    await expect(handle.promise).resolves.toEqual({ id: 'prod-1', name: 'X' });
  });

  it('routes to the product-edit photos namespace for a product_edit target', async () => {
    const handle = uploadProductPhoto({ kind: 'product_edit', editId: 'edit-1' }, { path: '/tmp/a.jpg', mime: 'image/jpeg' });
    await flush();

    const xhr = FakeXMLHttpRequest.instances[0]!;
    expect(xhr.url).toBe('http://localhost:4000/v1/product-edits/edit-1/photos');
    xhr.respond(201, { id: 'p', name: 'X' });
    await handle.promise;
  });

  it('reports upload progress ratios to registered listeners', async () => {
    const handle = uploadProductPhoto({ kind: 'draft', productId: 'prod-1' }, { path: '/tmp/photo.jpg', mime: 'image/jpeg' });
    await flush();

    const ratios: number[] = [];
    handle.onProgress((r) => ratios.push(r));

    const xhr = FakeXMLHttpRequest.instances[0]!;
    xhr.emitProgress(50, 100);
    xhr.emitProgress(100, 100);
    expect(ratios).toEqual([0.5, 1]);

    xhr.respond(201, { id: 'prod-1' });
    await handle.promise;
  });

  it('refreshes once on a 401 and retries with the rotated token', async () => {
    await secureStore.setAccessToken('expired');
    await secureStore.setRefreshToken('refresh-1');
    queueFetch(jsonResponse({ accessToken: 'new-access', refreshToken: 'refresh-2', expiresIn: 900 }));

    const handle = uploadProductPhoto({ kind: 'draft', productId: 'prod-1' }, { path: '/tmp/photo.jpg', mime: 'image/jpeg' });
    await flush();

    const firstXhr = FakeXMLHttpRequest.instances[0]!;
    firstXhr.respond(401, { code: 'token_expired', status: 401, title: 'expired' });
    await flush(); // let the refresh promise + retry attempt settle

    expect(FakeXMLHttpRequest.instances).toHaveLength(2);
    const retryXhr = FakeXMLHttpRequest.instances[1]!;
    expect(retryXhr.requestHeaders.Authorization).toBe('Bearer new-access');
    retryXhr.respond(201, { id: 'prod-1' });

    await expect(handle.promise).resolves.toEqual({ id: 'prod-1' });
  });

  it('rejects without a second refresh attempt when the refresh call itself fails', async () => {
    await secureStore.setAccessToken('expired');
    await secureStore.setRefreshToken('bad-refresh');
    queueFetch(problemResponse('invalid_token', 401, 'refresh bad'));

    const handle = uploadProductPhoto({ kind: 'draft', productId: 'prod-1' }, { path: '/tmp/photo.jpg', mime: 'image/jpeg' });
    await flush();

    const assertion = expect(handle.promise).rejects.toBeInstanceOf(ApiError);
    const xhr = FakeXMLHttpRequest.instances[0]!;
    xhr.respond(401, { code: 'token_expired', status: 401, title: 'expired' });

    await assertion;
    await flush();
    expect(FakeXMLHttpRequest.instances).toHaveLength(1); // no retry issued
  });

  it('rejects and never resolves after cancel(), even if the transport later delivers a response', async () => {
    const handle = uploadProductPhoto({ kind: 'draft', productId: 'prod-1' }, { path: '/tmp/photo.jpg', mime: 'image/jpeg' });
    await flush();

    // Attach the rejection expectation before triggering it, so the promise
    // is never briefly unhandled between cancel() and the assertion.
    const assertion = expect(handle.promise).rejects.toMatchObject({ code: 'upload_cancelled' });

    const xhr = FakeXMLHttpRequest.instances[0]!;
    handle.cancel();
    expect(xhr.aborted).toBe(true);

    // A late-arriving success must not flip an already-aborted request to resolved.
    xhr.respond(201, { id: 'prod-1' });

    await assertion;
  });

  it('surfaces a network_error ApiError on a transport failure', async () => {
    const handle = uploadProductPhoto({ kind: 'draft', productId: 'prod-1' }, { path: '/tmp/photo.jpg', mime: 'image/jpeg' });
    await flush();

    const assertion = expect(handle.promise).rejects.toMatchObject({ code: 'network_error' });
    FakeXMLHttpRequest.instances[0]!.networkError();

    await assertion;
  });

  it('surfaces a typed structured conflict (currentVersion) from a non-2xx JSON body', async () => {
    const handle = uploadProductPhoto({ kind: 'draft', productId: 'prod-1' }, { path: '/tmp/photo.jpg', mime: 'image/jpeg' });
    await flush();

    const assertion = expect(handle.promise).rejects.toMatchObject({ code: 'version_conflict', currentVersion: 4 });
    FakeXMLHttpRequest.instances[0]!.respond(409, {
      code: 'version_conflict',
      status: 409,
      title: 'stale',
      currentVersion: 4,
    });

    await assertion;
  });
});

describe('deleteProductPhoto / reorderProductPhotos', () => {
  beforeEach(() => __reset());

  it('deletes against the draft photos route', async () => {
    const f = queueFetch(jsonResponse({ id: 'prod-1' }));
    await deleteProductPhoto({ kind: 'draft', productId: 'prod-1' }, 'photo-1');
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/products/prod-1/photos/photo-1');
    expect((init as RequestInit).method).toBe('DELETE');
  });

  it('reorders against the product-edit photos route', async () => {
    const f = queueFetch(jsonResponse({ id: 'edit-1' }));
    await reorderProductPhotos({ kind: 'product_edit', editId: 'edit-1' }, ['a', 'b']);
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/product-edits/edit-1/photos/order');
    expect((init as RequestInit).method).toBe('PATCH');
    expect((init as RequestInit).body).toBe(JSON.stringify({ photoIds: ['a', 'b'] }));
  });
});
