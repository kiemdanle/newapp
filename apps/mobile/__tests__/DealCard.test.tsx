// apps/mobile/__tests__/DealCard.test.tsx
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealCard } from '../src/features/deals/DealCard';
import { ThemeProvider } from '../src/theme/ThemeProvider';

const deal = {
  id: 'd-1',
  userId: 'u-1',
  productId: 'p-1',
  price: 3.49,
  currency: 'USD',
  storeName: 'Aldi',
  photoUrl: null,
  expiryDate: null,
  note: 'half price',
  upvoteCount: 3,
  downvoteCount: 1,
  score: 0.4,
  status: 'visible' as const,
  createdAt: '2026-05-26T00:00:00.000Z',
  updatedAt: '2026-05-26T00:00:00.000Z',
  myVote: null,
  product: { id: 'p-1', name: 'Oat Milk', brand: 'Acme', imageUrl: null },
  author: { id: 'u-1', firstName: 'Ada', avatarUrl: null },
};

const mockVoteMutate = jest.fn();
const mockDeleteVoteMutate = jest.fn();

jest.mock('../src/api/deals', () => ({
  useDealVote: () => ({ mutate: mockVoteMutate, isPending: false }),
  useDeleteDealVote: () => ({ mutate: mockDeleteVoteMutate, isPending: false }),
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <ThemeProvider><QueryClientProvider client={qc}>{node}</QueryClientProvider></ThemeProvider>;
}

describe('DealCard', () => {
  beforeEach(() => {
    mockVoteMutate.mockClear();
    mockDeleteVoteMutate.mockClear();
  });

  it('renders product name, price and store', () => {
    const { getByText } = render(wrap(<DealCard deal={deal} onReport={() => {}} />));
    expect(getByText('Oat Milk')).toBeTruthy();
    expect(getByText(/Aldi/)).toBeTruthy();
  });

  it('calls vote mutation on thumb-up tap', () => {
    const { getByLabelText } = render(
      wrap(<DealCard deal={deal} onReport={() => {}} />),
    );
    fireEvent.press(getByLabelText('upvote'));
    expect(mockVoteMutate).toHaveBeenCalledWith(
      expect.objectContaining({ dealId: 'd-1', value: 1 }),
    );
  });

  it('opens the report sheet on long-press', () => {
    const onReport = jest.fn();
    const { getByLabelText } = render(wrap(<DealCard deal={deal} onReport={onReport} />));
    fireEvent(getByLabelText('deal-d-1'), 'longPress');
    expect(onReport).toHaveBeenCalledWith(deal);
  });
});
