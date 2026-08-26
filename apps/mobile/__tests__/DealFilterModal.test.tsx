import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DealFilterModal } from '../src/features/deals/DealFilterModal';
import { ThemeProvider } from '../src/theme/ThemeProvider';

jest.mock('../src/api/deals', () => ({
  useDealStores: () => ({
    data: {
      items: [
        { name: "Trader Joe's", count: 12 },
        { name: 'ALDI', count: 8 },
      ],
    },
  }),
}));

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </ThemeProvider>
  );
}

describe('DealFilterModal', () => {
  it('renders filter modal with store choices, price presets, and expiry options', () => {
    const { getByText, getByPlaceholderText } = render(
      wrap(
        <DealFilterModal
          visible={true}
          onClose={jest.fn()}
          filters={{ sort: 'score' }}
          onApply={jest.fn()}
        />,
      ),
    );

    expect(getByText('Filters')).toBeTruthy();
    expect(getByPlaceholderText('Search or enter store name…')).toBeTruthy();
    expect(getByText(/Trader Joe's/)).toBeTruthy();
    expect(getByText('Under $5')).toBeTruthy();
    expect(getByText('⏳ Expiring in 7 days')).toBeTruthy();
  });

  it('applies selected filters on Apply Filters press', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();

    const { getByText, getByPlaceholderText } = render(
      wrap(
        <DealFilterModal
          visible={true}
          onClose={onClose}
          filters={{ sort: 'score' }}
          onApply={onApply}
        />,
      ),
    );

    fireEvent.changeText(getByPlaceholderText('Search or enter store name…'), 'Costco');
    fireEvent.press(getByText('Under $5'));
    fireEvent.press(getByText('Apply Filters'));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'Costco',
        maxPrice: 5,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('resets filters when Reset All is pressed', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      wrap(
        <DealFilterModal
          visible={true}
          onClose={onClose}
          filters={{ sort: 'score', store: 'ALDI', maxPrice: 10 }}
          onApply={onApply}
        />,
      ),
    );

    fireEvent.press(getByText('Reset All'));
    fireEvent.press(getByText('Apply Filters'));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        sort: 'score',
        store: undefined,
        maxPrice: undefined,
      }),
    );
  });
});
