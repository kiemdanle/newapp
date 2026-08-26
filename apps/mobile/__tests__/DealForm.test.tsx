import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealForm } from '../src/features/deals/DealForm';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';

const mockCreateDeal = jest.fn().mockResolvedValue({ id: 'd-1' });
const mockUpdateDeal = jest.fn().mockResolvedValue({ id: 'd-1' });

jest.mock('../src/api/deals', () => ({
  useCreateDeal: () => ({ mutateAsync: mockCreateDeal, isPending: false }),
  useUpdateDeal: () => ({ mutateAsync: mockUpdateDeal, isPending: false }),
  useDealStores: () => ({ data: { items: [{ name: 'Aldi', count: 5 }] } }),
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient();
  return (
    <NavigationContainer>
      <QueryClientProvider client={qc}>
        <ThemeProvider>{node}</ThemeProvider>
      </QueryClientProvider>
    </NavigationContainer>
  );
}

describe('DealForm', () => {
  beforeEach(() => {
    mockCreateDeal.mockClear();
    mockUpdateDeal.mockClear();
  });

  it('blocks submit until price and store are filled', () => {
    const { getByText } = render(
      wrap(<DealForm product={{ id: 'p-1', name: 'Oat Milk' }} onDone={() => {}} />),
    );
    fireEvent.press(getByText('Post Deal to Community'));
    expect(mockCreateDeal).not.toHaveBeenCalled();
  });

  it('submits a valid deal with store name and price', async () => {
    const onDone = jest.fn();
    const { getByText, getByLabelText } = render(
      wrap(<DealForm product={{ id: 'p-1', name: 'Oat Milk' }} onDone={onDone} />),
    );
    fireEvent.changeText(getByLabelText('price'), '3.49');
    fireEvent.changeText(getByLabelText('store'), 'Aldi');
    fireEvent.press(getByText('Post Deal to Community'));
    await waitFor(() =>
      expect(mockCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'p-1', price: 3.49, storeName: 'Aldi' }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });

  it('submits updates when editing an existing deal', async () => {
    const onDone = jest.fn();
    const existing = {
      id: 'd-existing',
      userId: 'u-1',
      productId: 'p-1',
      price: 2.99,
      currency: 'USD',
      storeName: 'Trader Joe',
      photoUrl: null,
      expiryDate: '2026-09-01',
      note: 'Clearance',
      upvoteCount: 1,
      downvoteCount: 0,
      score: 0.5,
      status: 'visible' as const,
      createdAt: '2026-08-26T00:00:00.000Z',
      updatedAt: '2026-08-26T00:00:00.000Z',
      myVote: null,
    };

    const { getByText, getByLabelText } = render(
      wrap(
        <DealForm
          product={{ id: 'p-1', name: 'Oat Milk' }}
          existing={existing}
          onDone={onDone}
        />,
      ),
    );

    fireEvent.changeText(getByLabelText('price'), '1.99');
    fireEvent.press(getByText('Save Changes'));

    await waitFor(() =>
      expect(mockUpdateDeal).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'd-existing',
          patch: expect.objectContaining({ price: 1.99 }),
        }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });
});
