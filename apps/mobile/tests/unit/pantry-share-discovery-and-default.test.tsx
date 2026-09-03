import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScopeToggle } from '../../src/features/households/ScopeToggle';
import { HouseholdSettings } from '../../src/features/households/HouseholdSettings';
import { AddRecordForm } from '../../src/features/records/AddRecordForm';
import { usePantryScope } from '../../src/store/pantryScope';
import * as householdsApi from '../../src/api/households';
import * as recordsApi from '../../src/api/records';
import * as navigationRef from '../../src/navigation/navigationRef';

jest.mock('../../src/api/records', () => {
  const actual = jest.requireActual('../../src/api/records');
  return {
    ...actual,
    createLocalRecord: jest.fn().mockResolvedValue('rec-new-1'),
    useActiveRecords: () => [],
  };
});

jest.mock('../../src/api/products', () => ({
  useCreateOrResumeDraft: () => ({ mutateAsync: jest.fn() }),
  usePatchDraft: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock('../../src/api/product-photo-upload', () => ({
  uploadProductPhoto: jest.fn(),
}));

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('Pantry Share Discovery CTA and Default Household Mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    usePantryScope.setState({
      scope: 'all',
      householdId: null,
      defaultHouseholdId: null,
    });
  });

  it('renders discovery CTA in ScopeToggle when user has 0 households, and tapping navigates to Household screen', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: { items: [] },
      isLoading: false,
    } as any);

    const navigateSpy = jest.spyOn(navigationRef, 'navigate').mockImplementation(() => {});

    const { getByTestId, getByText } = render(<ScopeToggle />);

    expect(getByTestId('scope-toggle-discovery-cta')).toBeTruthy();
    expect(getByText('Share pantry with family or roommates')).toBeTruthy();

    fireEvent.press(getByTestId('scope-toggle-discovery-cta'));
    expect(navigateSpy).toHaveBeenCalledWith('Household');
  });

  it('toggles default household switch in HouseholdSettings and updates pantryScope store', () => {
    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: {
        items: [
          {
            id: 'hh-1',
            name: 'Family Kitchen',
            ownerUserId: 'u-1',
            myRole: 'owner',
            inviteCode: 'KITCH8',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      isLoading: false,
    } as any);

    jest.spyOn(householdsApi, 'useHousehold').mockReturnValue({
      data: {
        id: 'hh-1',
        name: 'Family Kitchen',
        ownerUserId: 'u-1',
        inviteCode: 'KITCH8',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    } as any);

    jest.spyOn(householdsApi, 'useHouseholdMembers').mockReturnValue({
      data: { items: [] },
    } as any);

    const { getByTestId } = renderWithClient(<HouseholdSettings />);

    const switchComponent = getByTestId('household-default-toggle-switch');
    expect(switchComponent.props.value).toBe(false);

    // Toggle ON
    fireEvent(switchComponent, 'valueChange', true);
    expect(usePantryScope.getState().defaultHouseholdId).toBe('hh-1');

    // Toggle OFF
    fireEvent(switchComponent, 'valueChange', false);
    expect(usePantryScope.getState().defaultHouseholdId).toBeNull();
  });

  it('AddRecordForm pre-selects defaultHouseholdId when in unified all scope', async () => {
    usePantryScope.setState({
      scope: 'all',
      householdId: null,
      defaultHouseholdId: 'hh-default-9',
    });

    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: {
        items: [
          { id: 'hh-default-9', name: 'Default Kitchen', ownerUserId: 'u-1', myRole: 'owner' },
        ],
      },
      isLoading: false,
    } as any);

    const onSaved = jest.fn();
    const { getByTestId } = render(
      <AddRecordForm productName="Apples" productId="prod-1" onSaved={onSaved} />,
    );

    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2026-10-15');
    fireEvent.press(getByTestId('add-record-save'));

    await waitFor(() => {
      expect(recordsApi.createLocalRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-1',
          householdId: 'hh-default-9',
        }),
      );
      expect(onSaved).toHaveBeenCalledWith('rec-new-1');
    });
  });

  it('AddRecordForm does NOT assign default household when scope is explicitly personal', async () => {
    usePantryScope.setState({
      scope: 'personal',
      householdId: null,
      defaultHouseholdId: 'hh-default-9',
    });

    jest.spyOn(householdsApi, 'useMyHouseholds').mockReturnValue({
      data: {
        items: [
          { id: 'hh-default-9', name: 'Default Kitchen', ownerUserId: 'u-1', myRole: 'owner' },
        ],
      },
      isLoading: false,
    } as any);

    const onSaved = jest.fn();
    const { getByTestId } = render(
      <AddRecordForm productName="Secret Snack" productId="prod-2" onSaved={onSaved} />,
    );

    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2026-10-15');
    fireEvent.press(getByTestId('add-record-save'));

    await waitFor(() => {
      expect(recordsApi.createLocalRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: 'prod-2',
          householdId: null,
        }),
      );
    });
  });
});
