import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PantrySearchBar } from './PantrySearchBar';

describe('PantrySearchBar', () => {
  const defaultProps = {
    value: '',
    onChangeText: jest.fn(),
    onOpenFilter: jest.fn(),
    activeFilterCount: 0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders search input and filter button', () => {
    const { getByTestId } = render(<PantrySearchBar {...defaultProps} />);
    expect(getByTestId('pantry-search-input')).toBeTruthy();
    expect(getByTestId('pantry-filter-toggle-btn')).toBeTruthy();
  });

  it('does not render view mode toggle button if onToggleViewMode is not provided', () => {
    const { queryByTestId } = render(<PantrySearchBar {...defaultProps} />);
    expect(queryByTestId('pantry-view-mode-toggle-btn')).toBeNull();
  });

  it('renders grid-outline icon and Switch to grid view label when viewMode is list', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <PantrySearchBar {...defaultProps} viewMode="list" onToggleViewMode={onToggle} />,
    );
    const toggleBtn = getByTestId('pantry-view-mode-toggle-btn');
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn.props.accessibilityLabel).toBe('Switch to grid view');

    fireEvent.press(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders list-outline icon and Switch to list view label when viewMode is grid', () => {
    const onToggle = jest.fn();
    const { getByTestId } = render(
      <PantrySearchBar {...defaultProps} viewMode="grid" onToggleViewMode={onToggle} />,
    );
    const toggleBtn = getByTestId('pantry-view-mode-toggle-btn');
    expect(toggleBtn).toBeTruthy();
    expect(toggleBtn.props.accessibilityLabel).toBe('Switch to list view');

    fireEvent.press(toggleBtn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
