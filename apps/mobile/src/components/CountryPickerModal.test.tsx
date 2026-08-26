import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CountryPickerModal } from './CountryPickerModal';

describe('CountryPickerModal component', () => {
  it('renders country list and handles country selection', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = render(
      <CountryPickerModal
        visible={true}
        selectedCountry="US"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    expect(getByText('Select Country & Region')).toBeTruthy();
    expect(getByTestId('country-item-VN')).toBeTruthy();

    fireEvent.press(getByTestId('country-item-VN'));
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VN', name: 'Vietnam' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('filters countries based on search query', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, queryByTestId } = render(
      <CountryPickerModal
        visible={true}
        selectedCountry="US"
        onSelect={onSelect}
        onClose={onClose}
      />,
    );

    const searchInput = getByTestId('country-search-input');
    fireEvent.changeText(searchInput, 'Japan');

    expect(getByTestId('country-item-JP')).toBeTruthy();
    expect(queryByTestId('country-item-VN')).toBeNull();
  });
});
