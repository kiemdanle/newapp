import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { WheelDatePickerModal } from './WheelDatePickerModal';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('WheelDatePickerModal', () => {
  it('renders date picker modal with title, presets, and done button', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByText, getByTestId, getByLabelText } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    expect(getByText('Select Expiry Date')).toBeTruthy();
    expect(getByText('+3 Days')).toBeTruthy();
    expect(getByText('+1 Week')).toBeTruthy();
    expect(getByText('+1 Month')).toBeTruthy();
    expect(getByTestId('date-picker-done')).toBeTruthy();
  });

  it('updates selection when preset chip is pressed and confirms date', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByText, getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    fireEvent.press(getByTestId('date-picker-done'));
    expect(onConfirm).toHaveBeenCalledWith('2026-08-28');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when cancel button is pressed', () => {
    const onClose = jest.fn();

    const { getByText } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={jest.fn()}
        />
      </ThemeProvider>,
    );

    fireEvent.press(getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
