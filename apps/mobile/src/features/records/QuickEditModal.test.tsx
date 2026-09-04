import React from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { QuickEditModal } from './QuickEditModal';
import type { LocalRecord } from '../../api/records';
import { renderWithTheme } from '../../../tests/helpers/renderWithTheme';

const mockRecord: LocalRecord = {
  id: 'rec-1',
  serverId: 'srv-1',
  clientId: 'cli-1',
  productId: null,
  customName: 'Apples',
  category: 'Produce',
  expiryDate: '2026-09-01',
  quantity: 4,
  unit: 'pcs',
  price: 2.0,
  store: 'Market',
  notes: null,
  photoUrl: null,
  status: 'active',
  notifyAt: [],
  householdId: null,
};

describe('QuickEditModal', () => {
  it('renders record fields and steppers properly', () => {
    const { getByLabelText, getByDisplayValue } = renderWithTheme(
      <QuickEditModal
        visible
        record={mockRecord}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
      'expyrico',
    );

    expect(getByDisplayValue('Apples')).toBeTruthy();
    expect(getByDisplayValue('4')).toBeTruthy();
    expect(getByDisplayValue('2026-09-01')).toBeTruthy();
    expect(getByLabelText('Increase quantity')).toBeTruthy();
    expect(getByLabelText('Decrease quantity')).toBeTruthy();
  });

  it('increments and decrements quantity via steppers', () => {
    const { getByLabelText, getByDisplayValue } = renderWithTheme(
      <QuickEditModal
        visible
        record={mockRecord}
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
      'expyrico',
    );

    const incBtn = getByLabelText('Increase quantity');
    fireEvent.press(incBtn);
    expect(getByDisplayValue('5')).toBeTruthy();

    const decBtn = getByLabelText('Decrease quantity');
    fireEvent.press(decBtn);
    expect(getByDisplayValue('4')).toBeTruthy();
  });

  it('saves updated fields when save button is pressed', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    const { getByTestId, getByLabelText } = renderWithTheme(
      <QuickEditModal
        visible
        record={mockRecord}
        onClose={onClose}
        onSave={onSave}
      />,
      'expyrico',
    );

    fireEvent.changeText(getByLabelText('Item Name'), 'Gala Apples');
    fireEvent.press(getByLabelText('Increase quantity'));

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).toHaveBeenCalledWith({
      customName: 'Gala Apples',
      quantity: 5,
      unit: 'pcs',
      expiryDate: '2026-09-01',
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('renders UnitSelector and allows selecting another top 4 unit', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { getByTestId } = renderWithTheme(
      <QuickEditModal
        visible
        record={mockRecord}
        onClose={jest.fn()}
        onSave={onSave}
      />,
      'expyrico',
    );

    // Initial unit 'pcs' is selected
    expect(getByTestId('unit-pill-pcs')).toBeTruthy();
    expect(getByTestId('unit-pill-pack')).toBeTruthy();
    expect(getByTestId('unit-pill-can')).toBeTruthy();
    expect(getByTestId('unit-pill-bottle')).toBeTruthy();
    expect(getByTestId('unit-pill-more')).toBeTruthy();

    // Select 'pack'
    fireEvent.press(getByTestId('unit-pill-pack'));

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: 'pack',
      }),
    );
  });

  it('selects an American import unit (oz) via More sheet and saves', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { getByTestId } = renderWithTheme(
      <QuickEditModal
        visible
        record={mockRecord}
        onClose={jest.fn()}
        onSave={onSave}
      />,
      'expyrico',
    );

    // Open More sheet
    fireEvent.press(getByTestId('unit-pill-more'));

    // Select 'oz'
    fireEvent.press(getByTestId('unit-option-oz'));

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        unit: 'oz',
      }),
    );
  });
});
