import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import NewDealScreen from '../app/(app)/deal/new';
import { ThemeProvider } from '../src/theme/ThemeProvider';
import { NavigationContainer } from '@react-navigation/native';

const mockUseDeal = jest.fn();
const mockUseProduct = jest.fn();
const mockUseProductSearch = jest.fn();
const mockPush = jest.fn();
let mockRouteParams: { editId?: string; productId?: string } = {};
jest.mock('../src/api/deals', () => ({
  useDeal: (...args: unknown[]) => mockUseDeal(...args),
  useCreateDeal: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useUpdateDeal: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDealStores: () => ({ data: { items: [] } }),
}));

jest.mock('../src/api/products', () => ({
  useProduct: (...args: unknown[]) => mockUseProduct(...args),
  useProductSearch: (...args: unknown[]) => mockUseProductSearch(...args),
}));

const mockPantryRecords = [
  {
    id: 'pantry-rec-1',
    serverId: 'srv-1',
    clientId: 'cli-1',
    productId: 'p-pantry-1',
    customName: 'Organic Whole Milk',
    category: 'Dairy',
    expiryDate: '2026-10-10',
    quantity: 2,
    unit: 'bottles',
    price: 3.99,
    store: 'Costco',
    notes: 'In fridge',
    photoUrl: null,
    status: 'active',
    notifyAt: [],
    householdId: null,
  },
];

jest.mock('../src/api/records', () => ({
  useActiveRecords: () => mockPantryRecords,
  useAllActiveRecords: () => mockPantryRecords,
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      goBack: jest.fn(),
      navigate: jest.fn(),
      push: mockPush,
    }),
    useRoute: () => ({
      params: mockRouteParams,
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
    mockPush.mockReset();
    mockRouteParams = {};
    mockUseDeal.mockReturnValue({ data: null, isLoading: false });
    mockUseProduct.mockReturnValue({ data: null, isLoading: false });
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

  it('navigates to Scan with target: deal when scan button is pressed', () => {
    const { getByText } = render(wrap(<NewDealScreen />));
    fireEvent.press(getByText(/Scan barcode on package/));
    expect(mockPush).toHaveBeenCalledWith('Scan', { target: 'deal' });
  });

  it('navigates to ProductNew with target: deal when create product CTA is pressed', () => {
    const { getByTestId } = render(wrap(<NewDealScreen />));
    fireEvent.press(getByTestId('deal-create-new-product-btn'));
    expect(mockPush).toHaveBeenCalledWith('ProductNew', { target: 'deal' });
  });

  it('loads and selects product automatically when productId is passed in route params', () => {
    mockRouteParams = { productId: 'p-100' };
    mockUseProduct.mockReturnValue({
      data: { id: 'p-100', name: 'Greek Yogurt', brand: 'Chobani' },
      isLoading: false,
    });

    const { getByText } = render(wrap(<NewDealScreen />));

    expect(getByText('SELECTED PRODUCT')).toBeTruthy();
    expect(getByText('Greek Yogurt')).toBeTruthy();
  });

  it('selects product from pantry modal and transitions to deal form', async () => {
    const { getByTestId, getByText } = render(wrap(<NewDealScreen />));

    fireEvent.press(getByTestId('deal-select-from-pantry-btn'));
    expect(getByTestId('pantry-select-modal')).toBeTruthy();

    fireEvent.press(getByTestId('pantry-select-item-pantry-rec-1'));

    expect(getByText('SELECTED PRODUCT')).toBeTruthy();
    expect(getByText('Organic Whole Milk')).toBeTruthy();
  });
});
