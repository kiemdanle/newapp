import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GiveawayFilterModal } from '../src/features/giveaways/GiveawayFilterModal';
import { ThemeProvider } from '../src/theme/ThemeProvider';

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <ThemeProvider>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </ThemeProvider>
  );
}

describe('GiveawayFilterModal', () => {
  it('renders status options, location input, photo toggle, and region toggles', () => {
    const { getByText, getByPlaceholderText, getByLabelText } = render(
      wrap(
        <GiveawayFilterModal
          visible={true}
          onClose={jest.fn()}
          filters={{ status: 'open', sort: 'new' }}
          onApply={jest.fn()}
        />,
      ),
    );

    expect(getByText('Filters')).toBeTruthy();
    expect(getByText('🎁 Open Offers')).toBeTruthy();
    expect(getByLabelText('Filter by location')).toBeTruthy();
    expect(getByText('📷 Has Photo Only')).toBeTruthy();
    expect(getByText('📍 Near Me (Local)')).toBeTruthy();
  });

  it('applies filters on Apply button press', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();

    const { getByText, getByLabelText } = render(
      wrap(
        <GiveawayFilterModal
          visible={true}
          onClose={onClose}
          filters={{ status: 'open', sort: 'new' }}
          onApply={onApply}
        />,
      ),
    );

    fireEvent.changeText(getByLabelText('Filter by location'), 'North End');
    fireEvent.press(getByText('📷 Has Photo Only'));
    fireEvent.press(getByText('Apply Filters'));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        location: 'North End',
        hasPhoto: true,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('resets filters when Reset All is pressed', () => {
    const onApply = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      wrap(
        <GiveawayFilterModal
          visible={true}
          onClose={onClose}
          filters={{ status: 'claimed', location: 'Downtown', hasPhoto: true }}
          onApply={onApply}
        />,
      ),
    );

    fireEvent.press(getByText('Reset All'));
    fireEvent.press(getByText('Apply Filters'));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        status: undefined,
        location: undefined,
        hasPhoto: undefined,
      }),
    );
  });
});
