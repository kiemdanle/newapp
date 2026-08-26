import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewDealScreen from '../app/(app)/deal/new';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';

const mockUseDeal = jest.fn();
const mockUseProductSearch = jest.fn();

jest.mock('../src/api/deals', () => ({
  useDeal: (...args: unknown[]) => mockUseDeal(...args),
  useCreateDeal: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateDeal: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDealStores: () => ({ data: { items: [] } }),
}));

jest.mock('../src/api/products', () => ({
  useProductSearch: (...args: unknown[]) => mockUseProductSearch(...args),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: jest.fn(),
      navigate: jest.fn(),
      push: jest.fn(),
    }),
    useRoute: () => ({
      params: {},
    }),
  };
});

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NavigationContainer>
      <QueryClientProvider client={qc}>
        <ThemeProvider>{node}</ThemeProvider>
      </QueryClientProvider>
    </NavigationContainer>
  );
}

describe('NewDealScreen', () => {
  beforeEach(() => {
    mockUseDeal.mockReturnValue({ data: null, isLoading: false });
    mockUseProductSearch.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders product search picker initially', () => {
    const { getByPlaceholderText, getByText } = render(wrap(<NewDealScreen />));

    expect(getByText('What item has a price drop?')).toBeTruthy();
    expect(getByPlaceholderText('Type product name or brand…')).toBeTruthy();
    expect(getByText(/Scan barcode on package/)).toBeTruthy();
  });

  it('displays search results when query matches', () => {
    mockUseProductSearch.mockReturnValue({
      data: [
        { id: 'p-1', name: 'Organic Almond Milk', brand: 'Silk' },
      ],
      isLoading: false,
    });

    const { getByText, getByPlaceholderText } = render(wrap(<NewDealScreen />));

    fireEvent.changeText(getByPlaceholderText('Type product name or brand…'), 'Silk');
    expect(getByText('Organic Almond Milk')).toBeTruthy();
    expect(getByText('Silk')).toBeTruthy();
  });

  it('transitions to deal form when product is selected', () => {
    mockUseProductSearch.mockReturnValue({
      data: [
        { id: 'p-1', name: 'Organic Almond Milk', brand: 'Silk' },
      ],
      isLoading: false,
    });

    const { getByText, queryByPlaceholderText } = render(wrap(<NewDealScreen />));

    fireEvent.press(getByText('Organic Almond Milk'));

    expect(getByText('SELECTED PRODUCT')).toBeTruthy();
    expect(getByText('Post Deal to Community')).toBeTruthy();
    expect(queryByPlaceholderText('Type product name or brand…')).toBeNull();
  });
});
