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

    const { getByTestId, getAllByText } = render(
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
    expect(getAllByText('Tháng 8').length).toBeGreaterThan(0);
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

  it('loops day wheel: scrolling up from Day 1 goes straight to Day 31', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-01"
          onClose={jest.fn()}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );
    // Day 1 in midBlock (2 * 31 = 62 items, offset 62 * 38 = 2356)
    // Scrolling up 1 item decreases y by 38 to 2318 -> item 61 (Day 31)
    const dayWheel = getByTestId('wheel-picker-day');
    fireEvent(dayWheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 2318 } },
    });
    fireEvent.press(getByTestId('date-picker-done'));
    expect(onConfirm).toHaveBeenCalledWith('2026-08-31');
  });

  it('loops day wheel: scrolling down from Day 31 wraps to Day 1', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-08-31"
          onClose={jest.fn()}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );
    // Day 31 in midBlock (2 * 31 + 30 = 92 items, offset 92 * 38 = 3496)
    // Scrolling down 1 item increases y by 38 to 3534 -> item 93 (Day 1)
    const dayWheel = getByTestId('wheel-picker-day');
    fireEvent(dayWheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 3534 } },
    });
    fireEvent.press(getByTestId('date-picker-done'));
    expect(onConfirm).toHaveBeenCalledWith('2026-08-01');
  });

  it('loops month wheel: scrolling up from January goes straight to December', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-01-15"
          onClose={jest.fn()}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );
    // January in midBlock (2 * 12 + 0 = 24 items, offset 24 * 38 = 912)
    // Scrolling up 1 item decreases y by 38 to 874 -> item 23 (December)
    const monthWheel = getByTestId('wheel-picker-month');
    fireEvent(monthWheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 874 } },
    });
    fireEvent.press(getByTestId('date-picker-done'));
    expect(onConfirm).toHaveBeenCalledWith('2026-12-15');
  });

  it('loops month wheel: scrolling down from December wraps to January', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-12-15"
          onClose={jest.fn()}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );
    // December in midBlock (2 * 12 + 11 = 35 items, offset 35 * 38 = 1330)
    // Scrolling down 1 item increases y by 38 to 1368 -> item 36 (January)
    const monthWheel = getByTestId('wheel-picker-month');
    fireEvent(monthWheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 1368 } },
    });
    fireEvent.press(getByTestId('date-picker-done'));
    expect(onConfirm).toHaveBeenCalledWith('2026-01-15');
  });

  it('adapts day wheel loop dynamically to month length (e.g. February has 28 days)', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2026-02-01"
          onClose={jest.fn()}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );
    // February (28 days): Day 1 in midBlock (2 * 28 + 0 = 56 items, offset 56 * 38 = 2128)
    // Scrolling up 1 item decreases y by 38 to 2090 -> item 55 (Day 28)
    const dayWheel = getByTestId('wheel-picker-day');
    fireEvent(dayWheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: 2090 } },
    });
    fireEvent.press(getByTestId('date-picker-done'));
    expect(onConfirm).toHaveBeenCalledWith('2026-02-28');
  });

  it('keeps year wheel bounded without looping', () => {
    const onConfirm = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <WheelDatePickerModal
          visible
          value="2025-08-15"
          onClose={jest.fn()}
          onConfirm={onConfirm}
        />
      </ThemeProvider>,
    );

    // Year wheel starts at startYear (2025), bounded at index 0 (offset 0)
    // Scrolling up past top clamps at index 0 without wrapping
    const yearWheel = getByTestId('wheel-picker-year');
    fireEvent(yearWheel, 'momentumScrollEnd', {
      nativeEvent: { contentOffset: { y: -38 } },
    });

    fireEvent.press(getByTestId('date-picker-done'));
    expect(onConfirm).toHaveBeenCalledWith('2025-08-15');
  });
});
