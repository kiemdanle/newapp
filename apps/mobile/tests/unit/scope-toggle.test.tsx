import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { ScopeToggle } from '../../src/features/households/ScopeToggle';
import { usePantryScope } from '../../src/store/pantryScope';
import { renderWithTheme } from '../helpers/renderWithTheme';
import * as householdsApi from '../../src/api/households';

jest.mock('../../src/api/households');

describe('ScopeToggle Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePantryScope.getState().setScope('all', null);
  });

  it('renders null when user belongs to 0 households', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as any);

    renderWithTheme(<ScopeToggle />, 'expyrico');
    expect(screen.queryByTestId('scope-toggle')).toBeNull();
  });

  it('renders All, Personal, and Household segments when user has 1 household', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: {
        items: [
          {
            id: 'hh-1',
            name: 'Family Pantry',
            role: 'owner',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
      },
      isLoading: false,
    } as any);

    renderWithTheme(<ScopeToggle />, 'expyrico');

    expect(screen.getByTestId('scope-toggle')).toBeTruthy();
    expect(screen.getByTestId('scope-toggle-all')).toBeTruthy();
    expect(screen.getByTestId('scope-toggle-personal')).toBeTruthy();
    expect(screen.getByTestId('scope-toggle-hh-1')).toBeTruthy();

    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Personal')).toBeTruthy();
    expect(screen.getByText('Family Pantry')).toBeTruthy();
  });

  it('initializes with All as selected and correct accessibility states', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: {
        items: [
          {
            id: 'hh-1',
            name: 'Family Pantry',
            role: 'owner',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
      },
      isLoading: false,
    } as any);

    renderWithTheme(<ScopeToggle />, 'expyrico');

    const allBtn = screen.getByTestId('scope-toggle-all');
    const personalBtn = screen.getByTestId('scope-toggle-personal');
    const hhBtn = screen.getByTestId('scope-toggle-hh-1');

    expect(allBtn.props.accessibilityState).toEqual({ selected: true });
    expect(personalBtn.props.accessibilityState).toEqual({ selected: false });
    expect(hhBtn.props.accessibilityState).toEqual({ selected: false });
  });

  it('switches to Personal and Household and back to All on press', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: {
        items: [
          {
            id: 'hh-1',
            name: 'Family Pantry',
            role: 'owner',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
      },
      isLoading: false,
    } as any);

    renderWithTheme(<ScopeToggle />, 'expyrico');

    // Switch to Personal
    fireEvent.press(screen.getByTestId('scope-toggle-personal'));
    expect(usePantryScope.getState().scope).toBe('personal');
    expect(usePantryScope.getState().householdId).toBeNull();

    // Switch to Household
    fireEvent.press(screen.getByTestId('scope-toggle-hh-1'));
    expect(usePantryScope.getState().scope).toBe('household');
    expect(usePantryScope.getState().householdId).toBe('hh-1');

    // Switch back to All
    fireEvent.press(screen.getByTestId('scope-toggle-all'));
    expect(usePantryScope.getState().scope).toBe('all');
    expect(usePantryScope.getState().householdId).toBeNull();
  });

  it('renders responsive segments when user belongs to multiple households (>3 segments)', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: {
        items: [
          {
            id: 'hh-1',
            name: 'Family Pantry',
            role: 'owner',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
          {
            id: 'hh-2',
            name: 'Cabin Kitchen',
            role: 'member',
            createdAt: '2026-01-01',
            updatedAt: '2026-01-01',
          },
        ],
      },
      isLoading: false,
    } as any);

    renderWithTheme(<ScopeToggle />, 'expyrico');

    expect(screen.getByTestId('scope-toggle-all')).toBeTruthy();
    expect(screen.getByTestId('scope-toggle-personal')).toBeTruthy();
    expect(screen.getByTestId('scope-toggle-hh-1')).toBeTruthy();
    expect(screen.getByTestId('scope-toggle-hh-2')).toBeTruthy();
  });
});
