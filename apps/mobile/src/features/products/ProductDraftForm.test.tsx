import { Text } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../theme/store';
import { createQueryClient } from '../../api/query-client';
import { queueFetch, jsonResponse, problemResponse } from '../../../tests/mocks/fetch';
import { ProductDraftForm } from './ProductDraftForm';
import type { Product } from '@expyrico/shared';

function wrap(node: React.ReactNode) {
  return (
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider>{node}</ThemeProvider>
    </QueryClientProvider>
  );
}

const PRODUCT: Product = {
  id: 'draft-1',
  barcode: '5449000000996',
  qrPayload: null,
  name: 'Frozen peas',
  description: null,
  brand: null,
  category: null,
  imageUrl: null,
  defaultShelfLifeDays: null,
  source: 'user',
  sourceId: null,
  isCommunityEligible: false,
  buyAgainCount: 0,
  buyAgainOnSaleCount: 0,
  wontBuyCount: 0,
  ratingCount: 0,
  reviewCount: 0,
  status: 'draft',
  version: 3,
  photos: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as unknown as Product;

describe('<ProductDraftForm />', () => {
  beforeEach(async () => {
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('shows the identifier read-only and prefills fields from the product', () => {
    const { getByTestId } = render(wrap(<ProductDraftForm initialProduct={PRODUCT} />));
    expect(getByTestId('draft-identifier').props.children).toBe('5449000000996');
    expect(getByTestId('draft-name').props.value).toBe('Frozen peas');
  });

  it('enforces the name/description length limits and requires a non-empty name', async () => {
    const { getByTestId, findByText } = render(wrap(<ProductDraftForm initialProduct={PRODUCT} />));
    expect(getByTestId('draft-name').props.maxLength).toBe(200);
    expect(getByTestId('draft-description').props.maxLength).toBe(2000);

    fireEvent.changeText(getByTestId('draft-name'), '');
    fireEvent.press(getByTestId('draft-save'));
    expect(await findByText('Name is required')).toBeTruthy();
  });

  it('updates the live description counter as the user types', () => {
    const { getByTestId } = render(wrap(<ProductDraftForm initialProduct={PRODUCT} />));
    fireEvent.changeText(getByTestId('draft-description'), 'Great for stir fry');
    expect(getByTestId('draft-description-counter').props.children).toEqual([18, '/', 2000]);
  });

  it('saves, advances the known version, and reports the saved product', async () => {
    const onSaved = jest.fn();
    queueFetch(jsonResponse({ ...PRODUCT, name: 'Frozen peas (organic)', version: 4 }));
    const { getByTestId } = render(wrap(<ProductDraftForm initialProduct={PRODUCT} onSaved={onSaved} />));

    fireEvent.changeText(getByTestId('draft-name'), 'Frozen peas (organic)');
    fireEvent.press(getByTestId('draft-save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ version: 4 })));
  });

  it('a 409 version_conflict preserves the dirty text and offers Refresh instead of overwriting it', async () => {
    queueFetch(
      new Response(
        JSON.stringify({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 9 }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      ),
    );
    const { getByTestId, findByTestId } = render(wrap(<ProductDraftForm initialProduct={PRODUCT} />));

    fireEvent.changeText(getByTestId('draft-name'), 'My in-progress edit');
    fireEvent.press(getByTestId('draft-save'));

    expect(await findByTestId('draft-conflict-banner')).toBeTruthy();
    // The typed text must survive the conflict untouched.
    expect(getByTestId('draft-name').props.value).toBe('My in-progress edit');

    queueFetch(jsonResponse({ ...PRODUCT, version: 9 }));
    fireEvent.press(getByTestId('draft-refresh'));

    await waitFor(() => expect(getByTestId('draft-name').props.value).toBe('My in-progress edit'));
  });

  it('surfaces a non-conflict save failure as a plain error without touching the fields', async () => {
    queueFetch(problemResponse('validation', 400, 'bad input'));
    const { getByTestId, findByText } = render(wrap(<ProductDraftForm initialProduct={PRODUCT} />));

    fireEvent.changeText(getByTestId('draft-name'), 'Edited name');
    fireEvent.press(getByTestId('draft-save'));

    expect(await findByText('bad input')).toBeTruthy();
    expect(getByTestId('draft-name').props.value).toBe('Edited name');
  });

  it('readOnly disables every field and hides Save', () => {
    const { getByTestId, queryByTestId } = render(wrap(<ProductDraftForm initialProduct={PRODUCT} readOnly />));
    expect(getByTestId('draft-name').props.editable).toBe(false);
    expect(queryByTestId('draft-save')).toBeNull();
  });

  it('renders a feedback banner when provided (changes_required moderation notes)', () => {
    const { getByText } = render(
      wrap(
        <ProductDraftForm
          initialProduct={PRODUCT}
          feedbackBanner={<Text>Please add a clearer product name</Text>}
        />,
      ),
    );
    expect(getByText('Please add a clearer product name')).toBeTruthy();
  });

  it('reports dirty state changes as the user edits and after a successful save', async () => {
    const onDirtyChange = jest.fn();
    queueFetch(jsonResponse({ ...PRODUCT, name: 'New name', version: 4 }));
    const { getByTestId } = render(wrap(<ProductDraftForm initialProduct={PRODUCT} onDirtyChange={onDirtyChange} />));

    fireEvent.changeText(getByTestId('draft-name'), 'New name');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);

    fireEvent.press(getByTestId('draft-save'));
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false));
  });
});
