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
      brand: null,
      category: 'Produce',
      quantity: 5,
      unit: 'pcs',
      expiryDate: '2026-09-01',
      location: null,
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

  it('auto-populates item name and category from product when customName is null', () => {
    const recordWithoutCustomName: LocalRecord = {
      ...mockRecord,
      customName: null,
      category: null,
    };

    const { getByDisplayValue } = renderWithTheme(
      <QuickEditModal
        visible
        record={recordWithoutCustomName}
        productName="Vinamilk Yogurt"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
      'expyrico',
    );

    expect(getByDisplayValue('Vinamilk Yogurt')).toBeTruthy();
  });

  it('allows selecting category from quick chips and typing custom category', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);

    const { getByTestId, getByLabelText, getByDisplayValue } = renderWithTheme(
      <QuickEditModal
        visible
        record={mockRecord}
        onClose={jest.fn()}
        onSave={onSave}
      />,
      'expyrico',
    );

    // Initial category 'Produce' is in the text field
    expect(getByDisplayValue('Produce')).toBeTruthy();

    // Select 'Dairy' chip
    fireEvent.press(getByTestId('quick-edit-cat-dairy'));
    expect(getByDisplayValue('Dairy')).toBeTruthy();

    // Or type a custom category
    fireEvent.changeText(getByLabelText('Category'), 'Fresh Fruits');
    expect(getByDisplayValue('Fresh Fruits')).toBeTruthy();

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'Fresh Fruits',
      }),
    );
  });

  it('blocks saving and opens date picker when expiryDate is empty', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const recordWithEmptyExpiry: LocalRecord = {
      ...mockRecord,
      expiryDate: '',
    };

    const { getByTestId } = renderWithTheme(
      <QuickEditModal
        visible
        record={recordWithEmptyExpiry}
        onClose={jest.fn()}
        onSave={onSave}
      />,
      'expyrico',
    );

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).not.toHaveBeenCalled();
    // Date picker is opened
    expect(getByTestId('date-picker-done')).toBeTruthy();
  });

  it('renders LocationSelector, selects location pill, and saves location', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const onClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <QuickEditModal
        visible
        record={mockRecord}
        onClose={onClose}
        onSave={onSave}
      />,
      'expyrico',
    );

    expect(getByTestId('quick-edit-location-selector')).toBeTruthy();
    expect(getByTestId('location-pill-fridge')).toBeTruthy();

    fireEvent.press(getByTestId('location-pill-fridge'));

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        location: 'Fridge',
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('tap-to-deselect location pill in QuickEditModal clears location to null', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const recordWithLocation: LocalRecord = {
      ...mockRecord,
      id: 'rec-loc',
      location: 'Freezer',
    };

    const { getByTestId } = renderWithTheme(
      <QuickEditModal
        visible
        record={recordWithLocation}
        onClose={jest.fn()}
        onSave={onSave}
      />,
      'expyrico',
    );

    // Press active Freezer pill to deselect it
    fireEvent.press(getByTestId('location-pill-freezer'));

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        location: null,
      }),
    );
  });

  it('renders Brand (optional) input pre-populated from record.brand and saves edited brand', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const recordWithBrand: LocalRecord = {
      ...mockRecord,
      id: 'rec-brand',
      brand: 'Chobani',
    };

    const { getByTestId, getByDisplayValue } = renderWithTheme(
      <QuickEditModal
        visible
        record={recordWithBrand}
        onClose={jest.fn()}
        onSave={onSave}
      />,
      'expyrico',
    );

    expect(getByDisplayValue('Chobani')).toBeTruthy();
    const brandInput = getByTestId('quick-edit-brand-input');
    expect(brandInput).toBeTruthy();

    fireEvent.changeText(brandInput, 'Fage Total\nGreek');

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        brand: 'Fage Total Greek',
      }),
    );
  });

  it('clearing brand field in QuickEditModal saves brand as null', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const recordWithBrand: LocalRecord = {
      ...mockRecord,
      id: 'rec-brand-clear',
      brand: 'Vinamilk',
    };

    const { getByTestId } = renderWithTheme(
      <QuickEditModal
        visible
        record={recordWithBrand}
        onClose={jest.fn()}
        onSave={onSave}
      />,
      'expyrico',
    );

    const brandInput = getByTestId('quick-edit-brand-input');
    fireEvent.changeText(brandInput, '   ');

    await act(async () => {
      fireEvent.press(getByTestId('save-quick-edit'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        brand: null,
      }),
    );
  });
});
