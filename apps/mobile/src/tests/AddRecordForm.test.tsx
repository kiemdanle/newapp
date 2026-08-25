import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type * as ExpyricoThemeModule from '@expyrico/theme';
import { AddRecordForm } from '../features/records/AddRecordForm';
import { createLocalRecord } from '../api/records';

jest.mock('../api/records', () => ({
  createLocalRecord: jest.fn().mockResolvedValue('local-id-1'),
  useActiveRecords: () => [],
}));

interface HouseholdsResult {
  data: { items: Array<{ id: string; name: string }> };
}
const mockMyHouseholds = jest.fn<HouseholdsResult, []>(() => ({ data: { items: [] } }));
jest.mock('../api/households', () => ({
  useMyHouseholds: () => mockMyHouseholds(),
}));

interface PantryScopeResult {
  scope: 'personal' | 'household';
  householdId: string | null;
  setScope: (...args: unknown[]) => void;
}
const mockPantryScope = jest.fn<PantryScopeResult, []>(() => ({ scope: 'personal', householdId: null, setScope: jest.fn() }));
jest.mock('../store/pantryScope', () => ({
  usePantryScope: () => mockPantryScope(),
}));

jest.mock('../theme/useTheme', () => ({
  useTheme: () => jest.requireActual<typeof ExpyricoThemeModule>('@expyrico/theme').themes.expyrico,
}));

describe('AddRecordForm', () => {
  it('shows a validation error when expiry is empty', async () => {
    const { getByTestId, findByText } = render(
      <AddRecordForm productName="Milk" productId="p-1" onSaved={jest.fn()} />,
    );
    fireEvent.press(getByTestId('add-record-save'));
    expect(await findByText(/required/i)).toBeTruthy();
  });

  it('calls createLocalRecord with productId + expiry and invokes onSaved', async () => {
    const onSaved = jest.fn();
    const { getByTestId } = render(
      <AddRecordForm productName="Milk" productId="p-1" onSaved={onSaved} />,
    );
    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2099-12-31');
    fireEvent.changeText(getByTestId('add-record-quantity'), '3');
    fireEvent.press(getByTestId('add-record-save'));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: 'p-1',
        expiryDate: '2099-12-31',
        quantity: 3,
        unit: 'pcs',
      }),
    );
  });

  it('lockedPersonalScope hides the household picker and persists householdId: null even from an active household scope', async () => {
    mockPantryScope.mockReturnValue({ scope: 'household', householdId: 'hh-1', setScope: jest.fn() });
    mockMyHouseholds.mockReturnValue({ data: { items: [{ id: 'hh-1', name: 'Our kitchen' }] } });

    const onSaved = jest.fn();
    const { getByTestId, queryByTestId, queryByText } = render(
      <AddRecordForm productName="Milk" productId="p-1" onSaved={onSaved} lockedPersonalScope />,
    );

    // No household picker at all — not even the "Personal" chip — while locked.
    expect(queryByTestId('add-record-pantry-personal')).toBeNull();
    expect(queryByTestId('add-record-pantry-hh-1')).toBeNull();
    expect(queryByText('Pantry')).toBeNull();

    fireEvent.changeText(getByTestId('add-record-expiry-input'), '2099-12-31');
    fireEvent.press(getByTestId('add-record-save'));

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith('local-id-1'));
    expect(createLocalRecord).toHaveBeenCalledWith(expect.objectContaining({ householdId: null }));
  });
});
