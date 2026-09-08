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
    expect(getByText('+3 Months')).toBeTruthy();
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

  it('allows typing date directly in ISO format and confirms', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    const textInput = getByTestId('date-picker-text-input');
    expect(textInput).toBeTruthy();
    expect(textInput.props.value).toMatch(/\d{2}\/\d{2}\/2026|2026-08-28/);
    fireEvent.changeText(textInput, '2026-10-25');
    fireEvent.press(getByTestId('date-picker-done'));

    expect(onConfirm).toHaveBeenCalledWith('2026-10-25');
    expect(onClose).toHaveBeenCalled();
  });

  it('allows typing date in DD/MM/YYYY format and converts to ISO on confirm', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    const textInput = getByTestId('date-picker-text-input');

    fireEvent.changeText(textInput, '15/12/2026');
    fireEvent.press(getByTestId('date-picker-done'));

    expect(onConfirm).toHaveBeenCalledWith('2026-12-15');
    expect(onClose).toHaveBeenCalled();
  });

  it('updates typed text input when preset chip is pressed', () => {
    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      </ThemeProvider>,
    );

    const textInput = getByTestId('date-picker-text-input');
    fireEvent.press(getByText('+3 Days'));
    expect(textInput.props.value).toMatch(/\d{2}\/\d{2}\/2026|\d{4}-\d{2}-\d{2}/);
  });

  it('formats date as DD/MM/YYYY and displays Vietnamese month names when user country is VN', () => {
    const { useSessionStore } = require('../auth/session-store');
    useSessionStore.setState({
      user: {
        id: 'u-vn',
        email: 'vn@example.com',
        country: 'VN',
      } as any,
    });

    const { getByTestId, getByText } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={jest.fn()}
          onConfirm={jest.fn()}
        />
      </ThemeProvider>,
    );

    const textInput = getByTestId('date-picker-text-input');
    expect(textInput.props.value).toBe('28/08/2026');
    expect(getByText('Tháng 8')).toBeTruthy();
  });

  it('allows natural typing like 13/9/26 and confirms', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    const textInput = getByTestId('date-picker-text-input');
    fireEvent.changeText(textInput, '13/9/26');
    fireEvent.press(getByTestId('date-picker-done'));

    expect(onConfirm).toHaveBeenCalledWith('2026-09-13');
    expect(onClose).toHaveBeenCalled();
  });

  it('allows natural typing with English textual months like Sep 13 and confirms', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    const textInput = getByTestId('date-picker-text-input');
    fireEvent.changeText(textInput, 'Sep 13');
    fireEvent.press(getByTestId('date-picker-done'));

    expect(onConfirm).toHaveBeenCalledWith(expect.stringMatching(/-\d{2}-13$/));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows relative shorthand like +1w and confirms', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    const textInput = getByTestId('date-picker-text-input');
    fireEvent.changeText(textInput, '+1w');
    fireEvent.press(getByTestId('date-picker-done'));

    expect(onConfirm).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(onClose).toHaveBeenCalled();
  });

  it('allows Vietnamese month typing like 13 thg 9 and confirms', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-28"
          onClose={onClose}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    const textInput = getByTestId('date-picker-text-input');
    fireEvent.changeText(textInput, '13 thg 9');
    fireEvent.press(getByTestId('date-picker-done'));

    expect(onConfirm).toHaveBeenCalledWith(expect.stringMatching(/-09-13$/));
    expect(onClose).toHaveBeenCalled();
  });
});
