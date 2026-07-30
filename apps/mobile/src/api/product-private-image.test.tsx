import { render, waitFor, cleanup } from '@testing-library/react-native';
import { __reset } from '../../tests/mocks/react-native-keychain';
import { queueFetch } from '../../tests/mocks/fetch';
import { secureStore } from '../auth/secure-store';
import { useSessionStore } from '../auth/session-store';
import { PrivateProductImage, purgePrivateImageCache, purgePrivateImageCacheForTarget } from './product-private-image';

const USER_A = { id: 'user-a', email: 'a@b.c' } as const;
const USER_B = { id: 'user-b', email: 'b@b.c' } as const;

function photoResponse(bytes = 'jpeg-bytes'): Response {
  return new Response(bytes, { status: 200, headers: { 'content-type': 'image/jpeg' } });
}

describe('PrivateProductImage', () => {
  beforeEach(() => {
    __reset();
    purgePrivateImageCache();
    useSessionStore.setState({ user: null, accessToken: null, refreshToken: null, hydrated: true, pendingAuth: null });
  });

  afterEach(cleanup);

  it('fetches with an Authorization header and renders the bytes as a data: URI, never a token in the URL', async () => {
    await secureStore.setAccessToken('access-a');
    useSessionStore.setState({ user: USER_A as never });
    const f = queueFetch(photoResponse());

    const { getByTestId } = render(
      <PrivateProductImage testID="img" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />,
    );

    await waitFor(() => {
      expect(getByTestId('img').props.source.uri).toMatch(/^data:image\/jpeg;base64,/);
    });

    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('http://localhost:4000/v1/products/p1/photos/photo-1/display');
    expect(url).not.toContain('access-a');
    expect((init as RequestInit).headers as Record<string, string>).toMatchObject({ Authorization: 'Bearer access-a' });
  });

  it('routes to the product-edit private-media namespace for a product_edit target', async () => {
    await secureStore.setAccessToken('access-a');
    useSessionStore.setState({ user: USER_A as never });
    const f = queueFetch(photoResponse());

    render(<PrivateProductImage target={{ kind: 'product_edit', editId: 'edit-1' }} photoId="photo-9" variant="thumb" />);

    await waitFor(() => expect(f).toHaveBeenCalledTimes(1));
    expect(f.mock.calls[0]![0]).toBe('http://localhost:4000/v1/product-edits/edit-1/photos/photo-9/thumb');
  });

  it('reuses the cached entry across remounts for the same user/target/photo/variant', async () => {
    await secureStore.setAccessToken('access-a');
    useSessionStore.setState({ user: USER_A as never });
    const f = queueFetch(photoResponse(), photoResponse());

    const first = render(
      <PrivateProductImage testID="img" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />,
    );
    await waitFor(() => expect(first.getByTestId('img').props.source.uri).toBeTruthy());
    first.unmount();

    const second = render(
      <PrivateProductImage testID="img" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />,
    );
    await waitFor(() => expect(second.getByTestId('img').props.source.uri).toBeTruthy());

    expect(f).toHaveBeenCalledTimes(1);
  });

  it('isolation: user A logging out and user B opening the same opaque IDs performs a fresh authorized request, never reusing A\'s bytes', async () => {
    await secureStore.setAccessToken('access-a');
    useSessionStore.setState({ user: USER_A as never });
    const f = queueFetch(photoResponse('bytes-for-a'), photoResponse('bytes-for-b'));

    const asA = render(
      <PrivateProductImage testID="img" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />,
    );
    await waitFor(() => expect(asA.getByTestId('img').props.source.uri).toBeTruthy());
    const uriA = asA.getByTestId('img').props.source.uri;
    asA.unmount();

    // A signs out (purges the cache); B signs in with the exact same opaque product/photo IDs.
    await useSessionStore.getState().signOut();
    await secureStore.setAccessToken('access-b');
    useSessionStore.setState({ user: USER_B as never });

    const asB = render(
      <PrivateProductImage testID="img" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />,
    );
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(asB.getByTestId('img').props.source.uri).toBeTruthy());
    const uriB = asB.getByTestId('img').props.source.uri;

    // Both requests really happened (not served from a leaked cache entry) and used B's own token.
    expect(uriA).not.toBe(uriB);
    const [, initB] = f.mock.calls[1]!;
    expect((initB as RequestInit).headers as Record<string, string>).toMatchObject({ Authorization: 'Bearer access-b' });
  });

  it('purges the cache on a 401 so a later retry issues a fresh request instead of replaying the rejection', async () => {
    useSessionStore.setState({ user: USER_A as never });
    queueFetch(new Response(JSON.stringify({ code: 'invalid_token' }), { status: 401 }));

    const { getByTestId, queryByTestId } = render(
      <PrivateProductImage testID="img" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />,
    );

    await waitFor(() => expect(queryByTestId('img')).toBeNull());

    const f = queueFetch(photoResponse());
    // Purge is asserted indirectly: a fresh mount now performs a brand-new
    // request rather than resolving instantly from a poisoned cache entry.
    const { getByTestId: getByTestId2 } = render(
      <PrivateProductImage testID="img2" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />,
    );
    await waitFor(() => expect(getByTestId2('img2').props.source.uri).toBeTruthy());
    expect(f).toHaveBeenCalledTimes(1);
    void getByTestId;
  });

  it('purgePrivateImageCacheForTarget clears only entries for that draft/edit, not unrelated ones', async () => {
    await secureStore.setAccessToken('access-a');
    useSessionStore.setState({ user: USER_A as never });
    const f = queueFetch(photoResponse(), photoResponse(), photoResponse());

    const p1 = render(<PrivateProductImage testID="p1" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />);
    await waitFor(() => expect(p1.getByTestId('p1').props.source.uri).toBeTruthy());
    const p2 = render(<PrivateProductImage testID="p2" target={{ kind: 'draft', productId: 'p2' }} photoId="photo-2" variant="display" />);
    await waitFor(() => expect(p2.getByTestId('p2').props.source.uri).toBeTruthy());
    expect(f).toHaveBeenCalledTimes(2);

    purgePrivateImageCacheForTarget({ kind: 'draft', productId: 'p1' });

    const p1Again = render(<PrivateProductImage testID="p1b" target={{ kind: 'draft', productId: 'p1' }} photoId="photo-1" variant="display" />);
    await waitFor(() => expect(p1Again.getByTestId('p1b').props.source.uri).toBeTruthy());
    expect(f).toHaveBeenCalledTimes(3); // p1 refetched

    const p2Again = render(<PrivateProductImage testID="p2b" target={{ kind: 'draft', productId: 'p2' }} photoId="photo-2" variant="display" />);
    await waitFor(() => expect(p2Again.getByTestId('p2b').props.source.uri).toBeTruthy());
    expect(f).toHaveBeenCalledTimes(3); // p2 still cached, no new call
  });
});
