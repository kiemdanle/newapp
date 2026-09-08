import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { LocationPickerModal } from '../../src/components/LocationPickerModal';

describe('LocationPickerModal', () => {
  it('renders search input and preset location chips', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <LocationPickerModal
        visible
        onClose={jest.fn()}
        onSelect={jest.fn()}
        currentLocation="Fridge"
      />,
      'expyrico',
    );

    expect(getByTestId('location-picker-modal')).toBeTruthy();
    expect(getByTestId('location-picker-search-input')).toBeTruthy();
    expect(getByTestId('location-picker-chip-spice-rack')).toBeTruthy();
    expect(getByText('Storage Location')).toBeTruthy();
  });

  it('selects preset chip and calls onSelect with Title Case and onClose', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <LocationPickerModal
        visible
        onClose={handleClose}
        onSelect={handleSelect}
        currentLocation={null}
      />,
      'expyrico',
    );

    fireEvent.press(getByTestId('location-picker-chip-spice-rack'));
    expect(handleSelect).toHaveBeenCalledWith('Spice Rack');
    expect(handleClose).toHaveBeenCalled();
  });

  it('typing custom location converts to Title Case on Apply and calls onClose', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <LocationPickerModal
        visible
        onClose={handleClose}
        onSelect={handleSelect}
        currentLocation={null}
      />,
      'expyrico',
    );

    const input = getByTestId('location-picker-search-input');
    fireEvent.changeText(input, 'wine cellar');

    const applyBtn = getByTestId('location-picker-apply-btn');
    expect(applyBtn).toBeTruthy();

    fireEvent.press(applyBtn);
    expect(handleSelect).toHaveBeenCalledWith('Wine Cellar');
    expect(handleClose).toHaveBeenCalled();
  });

  it('tapping Clear Location calls onSelect(null) and onClose', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId } = renderWithTheme(
      <LocationPickerModal
        visible
        onClose={handleClose}
        onSelect={handleSelect}
        currentLocation="Pantry"
      />,
      'expyrico',
    );

    const clearBtn = getByTestId('location-picker-clear-btn');
    expect(clearBtn).toBeTruthy();

    fireEvent.press(clearBtn);
    expect(handleSelect).toHaveBeenCalledWith(null);
    expect(handleClose).toHaveBeenCalled();
  });

  it('allows defining custom location via dedicated DEFINE CUSTOM LOCATION input and Apply button', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId, getByText } = renderWithTheme(
      <LocationPickerModal
        visible
        onClose={handleClose}
        onSelect={handleSelect}
        currentLocation={null}
      />,
      'expyrico',
    );

    expect(getByText('DEFINE CUSTOM LOCATION')).toBeTruthy();
    const customInput = getByTestId('location-picker-custom-input');
    expect(customInput).toBeTruthy();

    fireEvent.changeText(customInput, 'deep freezer');

    const applyBtn = getByTestId('location-picker-custom-apply-btn');
    fireEvent.press(applyBtn);

    expect(handleSelect).toHaveBeenCalledWith('Deep Freezer');
    expect(handleClose).toHaveBeenCalled();
  });

  it('shows fallback chip when search matches no presets and allows defining it directly', () => {
    const handleSelect = jest.fn();
    const handleClose = jest.fn();

    const { getByTestId, getByText } = renderWithTheme(
      <LocationPickerModal
        visible
        onClose={handleClose}
        onSelect={handleSelect}
        currentLocation={null}
      />,
      'expyrico',
    );

    const searchInput = getByTestId('location-picker-search-input');
    fireEvent.changeText(searchInput, 'garage shelf');

    expect(getByText(/No preset found for "garage shelf"/i)).toBeTruthy();
    const notFoundChip = getByTestId('location-picker-not-found-chip');
    expect(notFoundChip).toBeTruthy();

    fireEvent.press(notFoundChip);

    expect(handleSelect).toHaveBeenCalledWith('Garage Shelf');
    expect(handleClose).toHaveBeenCalled();
  });
});
