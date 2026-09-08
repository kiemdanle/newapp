import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { LocationSelector } from '../../src/components/LocationSelector';

describe('LocationSelector', () => {
  it('renders top 4 fixed pills (Fridge, Freezer, Pantry, Counter) and More pill in 1 row', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <LocationSelector value="Fridge" onChange={jest.fn()} />,
      'expyrico',
    );

    expect(getByTestId('location-pill-fridge')).toBeTruthy();
    expect(getByTestId('location-pill-freezer')).toBeTruthy();
    expect(getByTestId('location-pill-pantry')).toBeTruthy();
    expect(getByTestId('location-pill-counter')).toBeTruthy();
    expect(getByTestId('location-pill-more')).toBeTruthy();
    expect(getByText('Fridge')).toBeTruthy();
    expect(getByText('Freezer')).toBeTruthy();
    expect(getByText('Pantry')).toBeTruthy();
    expect(getByText('Counter')).toBeTruthy();
    expect(getByText('More')).toBeTruthy();
  });

  it('calls onChange with normalized Title Case location when an inactive pill is pressed', () => {
    const handleChange = jest.fn();
    const { getByTestId } = renderWithTheme(
      <LocationSelector value="Fridge" onChange={handleChange} />,
      'expyrico',
    );

    fireEvent.press(getByTestId('location-pill-freezer'));
    expect(handleChange).toHaveBeenCalledWith('Freezer');
  });

  it('tap-to-deselect: calls onChange(null) when the already active pill is pressed', () => {
    const handleChange = jest.fn();
    const { getByTestId } = renderWithTheme(
      <LocationSelector value="Fridge" onChange={handleChange} />,
      'expyrico',
    );

    fireEvent.press(getByTestId('location-pill-fridge'));
    expect(handleChange).toHaveBeenCalledWith(null);
  });

  it('displays custom location on the 5th pill in active highlight state', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <LocationSelector value="Spice Rack" onChange={jest.fn()} />,
      'expyrico',
    );

    const fifthPill = getByTestId('location-pill-more');
    expect(fifthPill).toBeTruthy();
    expect(getByText('Spice Rack')).toBeTruthy();
    expect(fifthPill.props.accessibilityState.selected).toBe(true);
  });

  it('opens LocationPickerModal when 5th pill is tapped', () => {
    const { getByTestId } = renderWithTheme(
      <LocationSelector value={null} onChange={jest.fn()} />,
      'expyrico',
    );

    fireEvent.press(getByTestId('location-pill-more'));
    expect(getByTestId('location-picker-modal')).toBeTruthy();
  });
});
