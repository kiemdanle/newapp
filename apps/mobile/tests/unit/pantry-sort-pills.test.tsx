// apps/mobile/tests/unit/pantry-sort-pills.test.tsx
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { PantrySortPills } from '../../src/features/records/PantrySortPills';
import { PANTRY_SORT_OPTIONS } from '../../src/features/records/pantryFilterTypes';
import { renderWithTheme } from '../helpers/renderWithTheme';

describe('PantrySortPills', () => {
  it('renders all sort options with proper testIDs', () => {
    const screen = renderWithTheme(
      <PantrySortPills selectedSort="expiry_asc" onSelectSort={jest.fn()} />,
      'expyrico',
    );

    for (const option of PANTRY_SORT_OPTIONS) {
      expect(screen.getByTestId(`pantry-sort-pill-${option.id}`)).toBeTruthy();
      expect(screen.getByText(option.label)).toBeTruthy();
    }
  });

  it('marks active sort pill with selected state', () => {
    const screen = renderWithTheme(
      <PantrySortPills selectedSort="name_asc" onSelectSort={jest.fn()} />,
      'expyrico',
    );

    const activePill = screen.getByTestId('pantry-sort-pill-name_asc');
    expect(activePill.props.accessibilityState.selected).toBe(true);

    const inactivePill = screen.getByTestId('pantry-sort-pill-expiry_asc');
    expect(inactivePill.props.accessibilityState.selected).toBe(false);
  });

  it('calls onSelectSort when pressing an option pill', () => {
    const onSelectSort = jest.fn();
    const screen = renderWithTheme(
      <PantrySortPills selectedSort="expiry_asc" onSelectSort={onSelectSort} />,
      'expyrico',
    );

    const quantityPill = screen.getByTestId('pantry-sort-pill-quantity_desc');
    fireEvent.press(quantityPill);

    expect(onSelectSort).toHaveBeenCalledWith('quantity_desc');
  });
});
