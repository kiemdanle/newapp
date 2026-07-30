import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { ProductEditRow } from '@expyrico/shared';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../theme/store';
import { EditSubmitPanel } from './EditSubmitPanel';
import type { DraftMutationCoordinator } from './draft-mutation-coordinator';
import { ApiError } from '../../api/errors';

const mockMutateAsync = jest.fn();
jest.mock('../../api/product-edits', () => ({
  useSubmitEdit: () => ({ mutateAsync: mockMutateAsync }),
}));

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

function edit(overrides: Partial<ProductEditRow> = {}): ProductEditRow {
  return {
    id: 'edit-1',
    productId: 'p1',
    status: 'draft',
    version: 1,
    baseProductVersion: 3,
    name: 'X',
    description: null,
    brand: null,
    category: null,
    photos: [],
    moderationFeedback: null,
    submittedAt: null,
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** Same hand-rolled-fake rationale as DraftSubmitPanel.test.tsx — this file
 * exercises EditSubmitPanel's own flush/submit orchestration, not the
 * coordinator itself. */
function makeCoordinator(flushed: ProductEditRow, opts: { hasConflict?: boolean } = {}) {
  const flushMetadata = jest.fn().mockResolvedValue(flushed);
  const hasConflict = jest.fn(() => opts.hasConflict ?? false);
  const coordinator: DraftMutationCoordinator<ProductEditRow> = {
    enqueue: jest.fn(),
    flushMetadata,
    reconcileConflict: jest.fn(),
    getState: () => flushed,
    hasConflict,
    onConflict: jest.fn(() => () => undefined),
  };
  return { coordinator, flushMetadata, hasConflict };
}

describe('<EditSubmitPanel />', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('flushes metadata and submits with the flushed id/version, no abuse token involved', async () => {
    const { coordinator, flushMetadata } = makeCoordinator(edit({ version: 3 }));
    mockMutateAsync.mockResolvedValue(edit({ version: 4, status: 'pending' }));
    const onSubmitted = jest.fn();

    const { getByTestId } = render(wrap(<EditSubmitPanel coordinator={coordinator} onSubmitted={onSubmitted} />));
    fireEvent.press(getByTestId('edit-submit'));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(flushMetadata).toHaveBeenCalled();
    expect(mockMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ id: 'edit-1', version: 3 }));
    expect(mockMutateAsync.mock.calls[0]![0]).not.toHaveProperty('abuseToken');
  });

  it('the disabled prop disables the button', () => {
    const { coordinator } = makeCoordinator(edit());
    const { getByTestId } = render(wrap(<EditSubmitPanel coordinator={coordinator} disabled onSubmitted={jest.fn()} />));
    expect(getByTestId('edit-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('blocks with a message when the flush surfaces a conflict', async () => {
    const { coordinator } = makeCoordinator(edit(), { hasConflict: true });
    const { getByTestId, findByTestId } = render(wrap(<EditSubmitPanel coordinator={coordinator} onSubmitted={jest.fn()} />));

    fireEvent.press(getByTestId('edit-submit'));

    expect(await findByTestId('edit-submit-error')).toBeTruthy();
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('a 409 edit_base_stale is terminal — no retry button, an admin-resolution message instead', async () => {
    const { coordinator } = makeCoordinator(edit());
    mockMutateAsync.mockRejectedValue(new ApiError({ code: 'edit_base_stale', status: 409, title: 'stale base' }));

    const { getByTestId, findByTestId, queryByTestId } = render(wrap(<EditSubmitPanel coordinator={coordinator} onSubmitted={jest.fn()} />));
    fireEvent.press(getByTestId('edit-submit'));

    expect(await findByTestId('edit-submit-error')).toBeTruthy();
    expect(queryByTestId('edit-submit')).toBeNull();
  });

  it('a plain version_conflict on submit surfaces a message and keeps the retry button available', async () => {
    const { coordinator } = makeCoordinator(edit());
    mockMutateAsync.mockRejectedValue(new ApiError({ code: 'version_conflict', status: 409, title: 'stale', currentVersion: 5 }));

    const { getByTestId, findByTestId } = render(wrap(<EditSubmitPanel coordinator={coordinator} onSubmitted={jest.fn()} />));
    fireEvent.press(getByTestId('edit-submit'));

    expect(await findByTestId('edit-submit-error')).toBeTruthy();
    expect(getByTestId('edit-submit')).toBeTruthy();
  });
});
