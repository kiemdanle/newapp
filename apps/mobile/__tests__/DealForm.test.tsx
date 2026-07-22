import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealForm } from '../src/features/deals/DealForm';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';

const mockCreateDeal = jest.fn().mockResolvedValue({ id: 'd-1' });

jest.mock('../src/api/deals', () => ({
  useCreateDeal: () => ({ mutateAsync: mockCreateDeal, isPending: false }),
  useUpdateDeal: () => ({ mutateAsync: jest.fn(), isPending: false }),
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
  beforeEach(() => mockCreateDeal.mockClear());

  it('blocks submit until price and store are filled', () => {
    const { getByText } = render(
      wrap(<DealForm product={{ id: 'p-1', name: 'Oat Milk' }} onDone={() => {}} />),
    );
    fireEvent.press(getByText('Post deal'));
    expect(mockCreateDeal).not.toHaveBeenCalled();
  });

  it('submits a valid deal', async () => {
    const onDone = jest.fn();
    const { getByText, getByLabelText } = render(
      wrap(<DealForm product={{ id: 'p-1', name: 'Oat Milk' }} onDone={onDone} />),
    );
    fireEvent.changeText(getByLabelText('price'), '3.49');
    fireEvent.changeText(getByLabelText('store'), 'Aldi');
    fireEvent.press(getByText('Post deal'));
    await waitFor(() =>
      expect(mockCreateDeal).toHaveBeenCalledWith(
        expect.objectContaining({ productId: 'p-1', price: 3.49, storeName: 'Aldi' }),
      ),
    );
    expect(onDone).toHaveBeenCalled();
  });
});
