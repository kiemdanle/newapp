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

  it('renders with placeholder, initial empty text, and submit icon', () => {
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
    expect(screen.getByTestId('pantry-search-submit-btn')).toBeTruthy();
    expect(screen.queryByTestId('pantry-search-clear-btn')).toBeNull();
    expect(screen.queryByTestId('pantry-filter-badge')).toBeNull();
  });

  it('does not trigger search automatically while typing (no autocomplete)', () => {
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

    // Advance timers - search must NEVER trigger automatically while typing
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(onChangeText).not.toHaveBeenCalled();
  });

  it('triggers search when user clicks the magnifier search icon', () => {
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
    act(() => {
      fireEvent.changeText(input, 'organic milk');
    });

    act(() => {
      fireEvent.press(screen.getByTestId('pantry-search-submit-btn'));
    });

    expect(onChangeText).toHaveBeenCalledWith('organic milk');
  });

  it('triggers search when user presses search button in keyboard (submitEditing)', () => {
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
    act(() => {
      fireEvent.changeText(input, 'fresh cheese');
    });
    act(() => {
      fireEvent(input, 'submitEditing');
    });

    expect(onChangeText).toHaveBeenCalledWith('fresh cheese');
  });

  it('clears draft text on clear button press without triggering search callback', () => {
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
    act(() => {
      fireEvent.press(clearBtn);
    });

    // Does NOT trigger onChangeText callback - only clears draft
    expect(onChangeText).not.toHaveBeenCalled();
    expect(screen.getByTestId('pantry-search-input').props.value).toBe('');
    expect(screen.queryByTestId('pantry-search-clear-btn')).toBeNull();

    // Now clicking search submits the empty search
    act(() => {
      fireEvent.press(screen.getByTestId('pantry-search-submit-btn'));
    });
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it('ensures neither typing nor clear button calls onChangeText until submitted', () => {
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
    act(() => {
      fireEvent.changeText(input, 'yogurt');
    });
    expect(onChangeText).not.toHaveBeenCalled();

    const clearBtn = screen.getByTestId('pantry-search-clear-btn');
    act(() => {
      fireEvent.press(clearBtn);
    });
    expect(onChangeText).not.toHaveBeenCalled();
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
