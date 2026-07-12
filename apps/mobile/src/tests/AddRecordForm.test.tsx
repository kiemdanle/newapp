import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { AddRecordForm } from '../features/records/AddRecordForm';
import { createLocalRecord } from '../api/records';

jest.mock('../api/records', () => ({
  createLocalRecord: jest.fn().mockResolvedValue('local-id-1'),
  useActiveRecords: () => [],
}));

jest.mock('../api/households', () => ({
  useMyHouseholds: () => ({ data: { items: [] } }),
}));

jest.mock('../store/pantryScope', () => ({
  usePantryScope: () => ({ scope: 'personal', householdId: null, setScope: jest.fn() }),
}));

jest.mock('../theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bg: '#FAFAF8',
      text: '#2C2C28',
      textMuted: '#8C8C85',
      primary: '#4BAE8A',
      primaryFg: '#FAFAF8',
      danger: '#E0442A',
      border: '#F0F0ED',
    },
    spacing: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24 },
    radii: { md: 8, lg: 12, sm: 4 },
  }),
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
});
