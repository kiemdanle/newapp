// apps/mobile/tests/unit/pantry-accessibility.test.tsx
import React from 'react';
import { PantrySearchBar } from '../../src/features/records/PantrySearchBar';
import { PantrySortPills } from '../../src/features/records/PantrySortPills';
import { PantryFilterModal } from '../../src/features/records/PantryFilterModal';
import { PANTRY_SORT_OPTIONS } from '../../src/features/records/pantryFilterTypes';
import { expyricoPalette, expyricoColors } from '../../local-packages/@expyrico/theme/dist';
import { renderWithTheme } from '../helpers/renderWithTheme';

describe('Pantry Accessibility Audit', () => {

  it('provides accessibilityRole and accessibilityLabel on PantrySearchBar controls', () => {
    const screen = renderWithTheme(
      <PantrySearchBar
        value="milk"
        onChangeText={jest.fn()}
        onOpenFilter={jest.fn()}
        activeFilterCount={2}
      />,
      'expyrico',
    );

    const input = screen.getByTestId('pantry-search-input');
    expect(input.props.accessibilityRole).toBe('search');
    expect(input.props.accessibilityLabel).toBe('Search pantry items');

    const clearBtn = screen.getByTestId('pantry-search-clear-btn');
    expect(clearBtn.props.accessibilityRole).toBe('button');
    expect(clearBtn.props.accessibilityLabel).toBe('Clear search');

    const filterBtn = screen.getByTestId('pantry-filter-toggle-btn');
    expect(filterBtn.props.accessibilityRole).toBe('button');
    expect(filterBtn.props.accessibilityLabel).toBe('Open filters, 2 active filters');
  });

  it('provides accessibilityRole, state, and labels on all PantrySortPills', () => {
    const screen = renderWithTheme(
      <PantrySortPills selectedSort="expiry_asc" onSelectSort={jest.fn()} />,
      'expyrico',
    );

    for (const option of PANTRY_SORT_OPTIONS) {
      const pill = screen.getByTestId(`pantry-sort-pill-${option.id}`);
      expect(pill.props.accessibilityRole).toBe('button');
      expect(pill.props.accessibilityLabel).toBe(option.accessibilityLabel);
      expect(pill.props.accessibilityState).toBeDefined();
    }
  });

  it('provides accessibilityRole and labels on PantryFilterModal controls', () => {
    const screen = renderWithTheme(
      <PantryFilterModal
        visible={true}
        onClose={jest.fn()}
        filters={{}}
        onApply={jest.fn()}
        records={[]}
      />,
      'expyrico',
    );

    const resetBtn = screen.getByTestId('pantry-filter-reset-btn');
    expect(resetBtn.props.accessibilityRole).toBe('button');
    expect(resetBtn.props.accessibilityLabel).toBe('Reset all filters');

    const applyBtn = screen.getByTestId('pantry-filter-apply-btn');
    expect(applyBtn.props.accessibilityRole).toBe('button');
    expect(applyBtn.props.accessibilityLabel).toContain('Apply filters');

    const inStockToggle = screen.getByTestId('pantry-filter-instock-toggle');
    expect(inStockToggle.props.accessibilityLabel).toBe('Toggle in-stock items only');
  });

  it('verifies palette status isolation: expired Alert Red is strictly isolated to danger/expired status', () => {
    // Assert Alert Red is assigned strictly to danger and expired, never to primary, accent, or background
    expect(expyricoPalette.expired).toBe('#E0442A');
    expect(expyricoColors.danger).toBe('#E0442A');
    expect(expyricoColors.expired).toBe('#E0442A');
    expect(expyricoColors.primary).not.toBe('#E0442A');
    expect(expyricoColors.accent).not.toBe('#E0442A');
    expect(expyricoColors.bg).not.toBe('#E0442A');
  });
});
