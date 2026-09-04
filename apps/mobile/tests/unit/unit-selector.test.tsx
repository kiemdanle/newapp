import React, { useState } from 'react';
import { act, fireEvent } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { UnitSelector } from '../../src/components/UnitSelector';
import { UnitPickerModal } from '../../src/components/UnitPickerModal';

jest.mock('../../src/utils/units', () => {
  const actual = jest.requireActual('../../src/utils/units');
  return {
    ...actual,
    usePantryTopUnits: () => ['pcs', 'pack', 'can', 'bottle'],
  };
});

describe('UnitSelector', () => {
  it('renders top 4 pills and 5th More pill in a clean 1-row layout', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <UnitSelector value="pcs" onChange={jest.fn()} />,
      'expyrico',
    );

    expect(getByTestId('unit-pill-pcs')).toBeTruthy();
    expect(getByTestId('unit-pill-pack')).toBeTruthy();
    expect(getByTestId('unit-pill-can')).toBeTruthy();
    expect(getByTestId('unit-pill-bottle')).toBeTruthy();
    expect(getByTestId('unit-pill-more')).toBeTruthy();
    expect(getByText('More')).toBeTruthy();
  });

  it('calls onChange directly when one of the top 4 pills is pressed', () => {
    const handleChange = jest.fn();
    const { getByTestId } = renderWithTheme(
      <UnitSelector value="pcs" onChange={handleChange} />,
      'expyrico',
    );

    fireEvent.press(getByTestId('unit-pill-can'));
    expect(handleChange).toHaveBeenCalledWith('can');
  });

  it('displays non-top-4 or American unit on the 5th pill in active highlight state', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <UnitSelector value="oz" onChange={jest.fn()} />,
      'expyrico',
    );

    const fifthPill = getByTestId('unit-pill-more');
    expect(fifthPill).toBeTruthy();
    expect(getByText('oz')).toBeTruthy();
    expect(fifthPill.props.accessibilityState.selected).toBe(true);
  });

  it('opens UnitPickerModal when 5th pill is tapped', () => {
    const { getByTestId } = renderWithTheme(
      <UnitSelector value="pcs" onChange={jest.fn()} />,
      'expyrico',
    );

    fireEvent.press(getByTestId('unit-pill-more'));
    expect(getByTestId('unit-picker-modal')).toBeTruthy();
  });
});

describe('UnitPickerModal', () => {
  it('renders American imports (oz, lb, fl oz) and metric units in categorized sections', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <UnitPickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        currentUnit="pcs"
      />,
      'expyrico',
    );

    expect(getByText('American Imports (US Customary)')).toBeTruthy();
    expect(getByTestId('unit-option-oz')).toBeTruthy();
    expect(getByTestId('unit-option-lb')).toBeTruthy();
    expect(getByTestId('unit-option-fl-oz')).toBeTruthy();
    expect(getByTestId('unit-option-kg')).toBeTruthy();
    expect(getByTestId('unit-option-box')).toBeTruthy();
  });

  it('filters units when searching', () => {
    const { getByTestId, queryByTestId } = renderWithTheme(
      <UnitPickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={jest.fn()}
        currentUnit="pcs"
      />,
      'expyrico',
    );

    const searchInput = getByTestId('unit-picker-search-input');
    fireEvent.changeText(searchInput, 'fluid ounce');

    expect(getByTestId('unit-option-fl-oz')).toBeTruthy();
    expect(queryByTestId('unit-option-kg')).toBeNull();
  });

  it('selects an American unit and triggers onSelect and onClose', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <UnitPickerModal
        visible={true}
        onClose={handleClose}
        onSelect={handleSelect}
        currentUnit="pcs"
      />,
      'expyrico',
    );

    fireEvent.press(getByTestId('unit-option-fl-oz'));
    expect(handleSelect).toHaveBeenCalledWith('fl oz');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies valid custom unit text', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <UnitPickerModal
        visible={true}
        onClose={handleClose}
        onSelect={handleSelect}
        currentUnit="pcs"
      />,
      'expyrico',
    );

    const customInput = getByTestId('unit-picker-custom-input');
    fireEvent.changeText(customInput, 'basket');

    const applyBtn = getByTestId('unit-picker-custom-apply-btn');
    fireEvent.press(applyBtn);

    expect(handleSelect).toHaveBeenCalledWith('basket');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid custom unit with Alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    const handleSelect = jest.fn();

    const { getByTestId } = renderWithTheme(
      <UnitPickerModal
        visible={true}
        onClose={jest.fn()}
        onSelect={handleSelect}
        currentUnit="pcs"
      />,
      'expyrico',
    );

    const customInput = getByTestId('unit-picker-custom-input');
    fireEvent.changeText(customInput, '<script>');

    const applyBtn = getByTestId('unit-picker-custom-apply-btn');
    fireEvent.press(applyBtn);

    expect(alertSpy).toHaveBeenCalledWith('Invalid Unit', expect.any(String));
    expect(handleSelect).not.toHaveBeenCalled();
  });
});
