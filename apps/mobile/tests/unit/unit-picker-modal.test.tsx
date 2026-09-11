import React from 'react';
import { fireEvent, within } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { UnitPickerModal } from '../../src/components/UnitPickerModal';

describe('UnitPickerModal', () => {
  it('renders search input, categories, and unit cards in light theme', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <UnitPickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        currentUnit="pcs"
      />,
      'expyrico',
    );

    expect(getByTestId('unit-picker-modal')).toBeTruthy();
    expect(getByTestId('unit-picker-search-input')).toBeTruthy();
    expect(getByTestId('unit-option-box')).toBeTruthy();
    expect(getByText('Select Unit')).toBeTruthy();
  });
  it('only displays description for abbreviation units and omits description for full-text units (box, bag)', () => {
    const { getByTestId } = renderWithTheme(
      <UnitPickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        currentUnit="pcs"
      />,
      'expyrico',
    );

    // Full text units (box, bag) show only their key text, no duplicate description
    const boxCard = getByTestId('unit-option-box');
    expect(within(boxCard).getByText('box')).toBeTruthy();
    expect(within(boxCard).queryByText('Box')).toBeNull();

    const bagCard = getByTestId('unit-option-bag');
    expect(within(bagCard).getByText('bag')).toBeTruthy();
    expect(within(bagCard).queryByText('Bag')).toBeNull();

    // Abbreviation units (kg, oz) show both key and description
    const kgCard = getByTestId('unit-option-kg');
    expect(within(kgCard).getByText('kg')).toBeTruthy();
    expect(within(kgCard).getByText('Kilogram')).toBeTruthy();

    const ozCard = getByTestId('unit-option-oz');
    expect(within(ozCard).getByText('oz')).toBeTruthy();
    expect(within(ozCard).getByText('Ounce')).toBeTruthy();
  });


  it('renders with cohesive dark theme styling in expyricoDark', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <UnitPickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        currentUnit="box"
      />,
      'expyricoDark',
    );

    const sheet = getByTestId('unit-picker-modal');
    expect(sheet.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#191F1B',
          borderColor: '#2D3A34',
        }),
      ]),
    );

    // Selected unit card (box)
    const selectedBox = getByTestId('unit-option-box');
    expect(selectedBox.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: 'rgba(75, 174, 138, 0.22)',
          borderColor: '#4BAE8A',
        }),
      ]),
    );

    // Unselected unit card (bag)
    const unselectedBag = getByTestId('unit-option-bag');
    expect(unselectedBag.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#1F342C',
          borderColor: '#2D3A34',
        }),
      ]),
    );

    // Category title has primary green highlight
    const categoryTitle = getByText('Packaged & Containers');
    expect(categoryTitle.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          color: '#4BAE8A',
        }),
      ]),
    );
  });

  it('selects unit card and calls onSelect with key and onClose', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <UnitPickerModal
        visible
        onClose={handleClose}
        onSelect={handleSelect}
        currentUnit="pcs"
      />,
      'expyrico',
    );

    fireEvent.press(getByTestId('unit-option-kg'));
    expect(handleSelect).toHaveBeenCalledWith('kg');
    expect(handleClose).toHaveBeenCalled();
  });

  it('allows defining custom unit via dedicated DEFINE CUSTOM UNIT input and Apply button', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId, getByText } = renderWithTheme(
      <UnitPickerModal
        visible
        onClose={handleClose}
        onSelect={handleSelect}
        currentUnit="pcs"
      />,
      'expyricoDark',
    );

    expect(getByText('DEFINE CUSTOM UNIT')).toBeTruthy();
    const customInput = getByTestId('unit-picker-custom-input');
    expect(customInput).toBeTruthy();

    fireEvent.changeText(customInput, 'crate');

    const applyBtn = getByTestId('unit-picker-custom-apply-btn');
    fireEvent.press(applyBtn);

    expect(handleSelect).toHaveBeenCalledWith('crate');
    expect(handleClose).toHaveBeenCalled();
  });

  it('shows fallback chip when search matches no presets and allows defining it directly', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId, getByText } = renderWithTheme(
      <UnitPickerModal
        visible
        onClose={handleClose}
        onSelect={handleSelect}
        currentUnit="pcs"
      />,
      'expyricoDark',
    );

    const input = getByTestId('unit-picker-search-input');
    fireEvent.changeText(input, 'bushel');

    expect(getByText(/No preset unit found for "bushel"/)).toBeTruthy();
    const fallbackChip = getByTestId('unit-picker-not-found-chip');
    expect(fallbackChip).toBeTruthy();

    fireEvent.press(fallbackChip);
    expect(handleSelect).toHaveBeenCalledWith('bushel');
    expect(handleClose).toHaveBeenCalled();
  });
});
