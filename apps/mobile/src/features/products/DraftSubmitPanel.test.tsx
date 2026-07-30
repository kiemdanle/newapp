import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { Product } from '@expyrico/shared';
import { ThemeProvider } from '../../theme/ThemeProvider';
import { initThemeStore, useThemeStore } from '../../theme/store';
import { DraftSubmitPanel } from './DraftSubmitPanel';
import type { DraftMutationCoordinator } from './draft-mutation-coordinator';
import { ApiError } from '../../api/errors';

const mockMutateAsync = jest.fn();
jest.mock('../../api/products', () => ({
  useSubmitDraft: () => ({ mutateAsync: mockMutateAsync }),
}));

const mockExecuteAssessment = jest.fn();
jest.mock('../../security/product-creation-assessment', () => ({
  executeProductSubmitAssessment: () => mockExecuteAssessment(),
}));

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    barcode: '123',
    qrPayload: null,
    name: 'X',
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
    version: 1,
    photos: [],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

/** A hand-rolled fake, same rationale as ProductPhotoEditor.test.tsx's own —
 * this file exercises DraftSubmitPanel's flush/token/retry orchestration,
 * not the coordinator itself (already exhaustively covered elsewhere). */
function makeCoordinator(flushed: Product, opts: { hasConflict?: boolean } = {}) {
  const flushMetadata = jest.fn().mockResolvedValue(flushed);
  const hasConflict = jest.fn(() => opts.hasConflict ?? false);
  const coordinator: DraftMutationCoordinator<Product> = {
    enqueue: jest.fn(),
    flushMetadata,
    reconcileConflict: jest.fn(),
    getState: () => flushed,
    hasConflict,
    onConflict: jest.fn(() => () => undefined),
  };
  return { coordinator, flushMetadata, hasConflict };
}

describe('<DraftSubmitPanel />', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    useThemeStore.setState({ themeId: 'expyrico', hydrated: false });
    await initThemeStore();
  });

  it('flushes metadata, mints a fresh token, and submits with the flushed id/version', async () => {
    const { coordinator, flushMetadata } = makeCoordinator(product({ version: 3 }));
    mockExecuteAssessment.mockResolvedValue({ token: 'tok-1', platform: 'android' });
    mockMutateAsync.mockResolvedValue(product({ version: 4 }));
    const onSubmitted = jest.fn();

    const { getByTestId } = render(wrap(<DraftSubmitPanel coordinator={coordinator} onSubmitted={onSubmitted} />));
    fireEvent.press(getByTestId('draft-submit'));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    expect(flushMetadata).toHaveBeenCalled();
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', version: 3, abuseToken: 'tok-1', platform: 'android' }),
    );
  });

  it('the disabled prop disables the button so an unsettled draft cannot submit', () => {
    const { coordinator } = makeCoordinator(product());
    const { getByTestId } = render(wrap(<DraftSubmitPanel coordinator={coordinator} disabled onSubmitted={jest.fn()} />));
    expect(getByTestId('draft-submit').props.accessibilityState.disabled).toBe(true);
  });

  it('blocks with a message when the flush surfaces a conflict, without minting a token', async () => {
    const { coordinator } = makeCoordinator(product(), { hasConflict: true });
    const { getByTestId, findByTestId } = render(wrap(<DraftSubmitPanel coordinator={coordinator} onSubmitted={jest.fn()} />));

    fireEvent.press(getByTestId('draft-submit'));

    expect(await findByTestId('draft-submit-error')).toBeTruthy();
    expect(mockExecuteAssessment).not.toHaveBeenCalled();
  });

  it('a 503 temporarily_unavailable response is retryable and reuses the same idempotency key with a fresh token', async () => {
    const { coordinator } = makeCoordinator(product());
    mockExecuteAssessment
      .mockResolvedValueOnce({ token: 'tok-1', platform: 'android' })
      .mockResolvedValueOnce({ token: 'tok-2', platform: 'android' });
    mockMutateAsync
      .mockRejectedValueOnce(new ApiError({ code: 'temporarily_unavailable', status: 503, title: 'try later' }))
      .mockResolvedValueOnce(product({ version: 2 }));

    const { getByTestId, findByTestId, findByText } = render(
      wrap(<DraftSubmitPanel coordinator={coordinator} onSubmitted={jest.fn()} />),
    );
    fireEvent.press(getByTestId('draft-submit'));

    expect(await findByTestId('draft-submit-error')).toBeTruthy();
    expect(await findByText('Retry submit')).toBeTruthy();

    fireEvent.press(getByTestId('draft-submit'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));

    const calls = mockMutateAsync.mock.calls as Array<[{ idempotencyKey: string; abuseToken: string }]>;
    expect(calls[1]![0].idempotencyKey).toBe(calls[0]![0].idempotencyKey);
    expect(calls[1]![0].abuseToken).not.toBe(calls[0]![0].abuseToken);
  });

  it('a 403 abuse_check_failed rejection preserves the draft and mints a fresh idempotency key on the next attempt', async () => {
    const { coordinator } = makeCoordinator(product());
    mockExecuteAssessment.mockResolvedValue({ token: 'tok-1', platform: 'android' });
    mockMutateAsync
      .mockRejectedValueOnce(new ApiError({ code: 'abuse_check_failed', status: 403, title: 'rejected' }))
      .mockResolvedValueOnce(product({ version: 2 }));

    const { getByTestId, findByTestId } = render(wrap(<DraftSubmitPanel coordinator={coordinator} onSubmitted={jest.fn()} />));
    fireEvent.press(getByTestId('draft-submit'));
    expect(await findByTestId('draft-submit-error')).toBeTruthy();

    fireEvent.press(getByTestId('draft-submit'));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));

    const calls = mockMutateAsync.mock.calls as Array<[{ idempotencyKey: string }]>;
    expect(calls[1]![0].idempotencyKey).not.toBe(calls[0]![0].idempotencyKey);
  });

  it('surfaces any other failure as a plain message', async () => {
    const { coordinator } = makeCoordinator(product());
    mockExecuteAssessment.mockResolvedValue({ token: 'tok-1', platform: 'android' });
    mockMutateAsync.mockRejectedValue(new Error('network down'));

    const { getByTestId, findByText } = render(wrap(<DraftSubmitPanel coordinator={coordinator} onSubmitted={jest.fn()} />));
    fireEvent.press(getByTestId('draft-submit'));

    expect(await findByText('network down')).toBeTruthy();
  });
});
