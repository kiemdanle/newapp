import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { LocationSelector } from '../../src/components/LocationSelector';

describe('LocationSelector', () => {
  it('renders top 2 visible pills (Fridge, Freezer) and More pill in 1 row without truncation', () => {
    const { getByTestId, queryByTestId, getByText } = renderWithTheme(
      <LocationSelector value="Fridge" onChange={jest.fn()} />,
      'expyrico',
    );

    expect(getByTestId('location-pill-fridge')).toBeTruthy();
    expect(getByTestId('location-pill-freezer')).toBeTruthy();
    expect(getByTestId('location-pill-more')).toBeTruthy();

    // Pantry and Counter are now inside the More modal, not crowded in the top row
    expect(queryByTestId('location-pill-pantry')).toBeNull();
    expect(queryByTestId('location-pill-counter')).toBeNull();

    expect(getByText('Fridge')).toBeTruthy();
    expect(getByText('Freezer')).toBeTruthy();
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

  it('displays Pantry and Counter on the adaptive More pill in active highlight state', () => {
    const { getByTestId: getPantryTestId, getByText: getPantryText } = renderWithTheme(
      <LocationSelector value="Pantry" onChange={jest.fn()} />,
      'expyrico',
    );

    const pantryPill = getPantryTestId('location-pill-more');
    expect(pantryPill).toBeTruthy();
    expect(getPantryText('Pantry')).toBeTruthy();
    expect(pantryPill.props.accessibilityState.selected).toBe(true);

    const { getByTestId: getCounterTestId, getByText: getCounterText } = renderWithTheme(
      <LocationSelector value="Counter" onChange={jest.fn()} />,
      'expyrico',
    );

    const counterPill = getCounterTestId('location-pill-more');
    expect(counterPill).toBeTruthy();
    expect(getCounterText('Counter')).toBeTruthy();
    expect(counterPill.props.accessibilityState.selected).toBe(true);
  });

  it('displays custom location on the adaptive More pill in active highlight state', () => {
    const { getByTestId, getByText } = renderWithTheme(
      <LocationSelector value="Spice Rack" onChange={jest.fn()} />,
      'expyrico',
    );

    const morePill = getByTestId('location-pill-more');
    expect(morePill).toBeTruthy();
    expect(getByText('Spice Rack')).toBeTruthy();
    expect(morePill.props.accessibilityState.selected).toBe(true);
  });

  it('opens LocationPickerModal when 5th pill is tapped', () => {
    const { getByTestId } = renderWithTheme(
      <LocationSelector value={null} onChange={jest.fn()} />,
      'expyrico',
    );

    fireEvent.press(getByTestId('location-pill-more'));
    expect(getByTestId('location-picker-modal')).toBeTruthy();
  });

  it('renders cohesive dark theme styles under expyricoDark', () => {
    const { getByTestId } = renderWithTheme(
      <LocationSelector value="Fridge" onChange={jest.fn()} />,
      'expyricoDark',
    );

    const fridgePill = getByTestId('location-pill-fridge');
    expect(fridgePill.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#4BAE8A', // primary
          borderColor: '#4BAE8A',
        }),
      ]),
    );

    const freezerPill = getByTestId('location-pill-freezer');
    expect(freezerPill.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#1F342C', // bgGlass in dark mode
          borderColor: '#2D3A34',     // border in dark mode
        }),
      ]),
    );
  });
});
