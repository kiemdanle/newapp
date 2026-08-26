import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ManualCodeEntryModal } from './ManualCodeEntryModal';

describe('ManualCodeEntryModal component', () => {
  it('renders modal and validates barcode length', async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = render(
      <ManualCodeEntryModal visible={true} onClose={onClose} onSubmit={onSubmit} />,
    );

    expect(getByText('Add Product Manually')).toBeTruthy();

    const input = getByTestId('manual-code-input');
    const submitBtn = getByTestId('manual-code-submit-btn');

    // Entering a short/invalid barcode disables or rejects submit
    fireEvent.changeText(input, '12345');
    fireEvent.press(submitBtn);
    expect(onSubmit).not.toHaveBeenCalled();

    // Entering a valid 13-digit EAN barcode
    fireEvent.changeText(input, '5449000000996');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('5449000000996', 'barcode');
    });
  });

  it('allows toggling to QR code mode and submits alphanumeric payload', async () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();

    const { getByTestId } = render(
      <ManualCodeEntryModal visible={true} onClose={onClose} onSubmit={onSubmit} />,
    );

    const qrToggle = getByTestId('toggle-qr-btn');
    fireEvent.press(qrToggle);

    const input = getByTestId('manual-code-input');
    const submitBtn = getByTestId('manual-code-submit-btn');

    fireEvent.changeText(input, 'https://example.com/qr/12345');
    fireEvent.press(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('https://example.com/qr/12345', 'qr');
    });
  });
});
