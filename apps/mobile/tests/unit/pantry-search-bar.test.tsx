// apps/mobile/tests/unit/pantry-search-bar.test.tsx
import React from 'react';
import { fireEvent, act } from '@testing-library/react-native';
import { PantrySearchBar } from '../../src/features/records/PantrySearchBar';
import { renderWithTheme } from '../helpers/renderWithTheme';

describe('PantrySearchBar', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders with placeholder and initial empty text', () => {
    const screen = renderWithTheme(
      <PantrySearchBar
        value=""
        onChangeText={jest.fn()}
        onOpenFilter={jest.fn()}
        activeFilterCount={0}
      />,
      'expyrico',
    );

    expect(screen.getByTestId('pantry-search-input')).toBeTruthy();
    expect(screen.queryByTestId('pantry-search-clear-btn')).toBeNull();
    expect(screen.queryByTestId('pantry-filter-badge')).toBeNull();
  });

  it('debounces onChangeText calls by 300ms', () => {
    const onChangeText = jest.fn();
    const screen = renderWithTheme(
      <PantrySearchBar
        value=""
        onChangeText={onChangeText}
        onOpenFilter={jest.fn()}
        activeFilterCount={0}
      />,
      'expyrico',
    );

    const input = screen.getByTestId('pantry-search-input');
    fireEvent.changeText(input, 'organic milk');

    // Should not fire immediately
    expect(onChangeText).not.toHaveBeenCalled();

    // Advance timers by 299ms
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(onChangeText).not.toHaveBeenCalled();

    // Advance to 300ms
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onChangeText).toHaveBeenCalledWith('organic milk');
  });

  it('clears text immediately on clear button press', () => {
    const onChangeText = jest.fn();
    const screen = renderWithTheme(
      <PantrySearchBar
        value="apples"
        onChangeText={onChangeText}
        onOpenFilter={jest.fn()}
        activeFilterCount={0}
      />,
      'expyrico',
    );

    const clearBtn = screen.getByTestId('pantry-search-clear-btn');
    fireEvent.press(clearBtn);

    expect(onChangeText).toHaveBeenCalledWith('');
    expect(screen.queryByTestId('pantry-search-clear-btn')).toBeNull();
  });

  it('displays filter badge when activeFilterCount > 0 and calls onOpenFilter', () => {
    const onOpenFilter = jest.fn();
    const screen = renderWithTheme(
      <PantrySearchBar
        value=""
        onChangeText={jest.fn()}
        onOpenFilter={onOpenFilter}
        activeFilterCount={3}
      />,
      'expyrico',
    );

    const badge = screen.getByTestId('pantry-filter-badge');
    expect(badge).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();

    const filterBtn = screen.getByTestId('pantry-filter-toggle-btn');
    fireEvent.press(filterBtn);
    expect(onOpenFilter).toHaveBeenCalledTimes(1);
  });
});
