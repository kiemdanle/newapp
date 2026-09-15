import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { AppAlertModal } from './AppAlertModal';
import { useAlertStore, showAlert } from '../store/alertStore';
import { ThemeProvider } from '../theme/ThemeProvider';

function wrap(node: React.ReactNode) {
  return <ThemeProvider>{node}</ThemeProvider>;
}

describe('AppAlertModal', () => {
  beforeEach(() => {
    useAlertStore.setState({ current: null });
  });

  it('renders nothing when current alert is null', () => {
    const { queryByTestId } = render(wrap(<AppAlertModal />));
    expect(queryByTestId('app-alert-modal')).toBeNull();
  });

  it('renders title, message, and default OK button when alert is triggered', () => {
    const onDismiss = jest.fn();
    showAlert('Notice', 'Operation completed successfully.', undefined, { onDismiss });

    const { getByTestId, getByText } = render(wrap(<AppAlertModal />));

    expect(getByTestId('app-alert-modal')).toBeTruthy();
    expect(getByTestId('app-alert-title')).toBeTruthy();
    expect(getByText('Notice')).toBeTruthy();
    expect(getByTestId('app-alert-message')).toBeTruthy();
    expect(getByText('Operation completed successfully.')).toBeTruthy();

    const okBtn = getByText('OK');
    expect(okBtn).toBeTruthy();
    fireEvent.press(okBtn);

    expect(useAlertStore.getState().current).toBeNull();
  });

  it('renders 2 buttons side-by-side with destructive and cancel styles and triggers callback', () => {
    const onDelete = jest.fn();
    const onCancel = jest.fn();

    showAlert(
      'Delete Item',
      'Are you sure you want to delete?',
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel, testID: 'alert-cancel-btn' },
        { text: 'Delete', style: 'destructive', onPress: onDelete, testID: 'alert-delete-btn' },
      ],
    );

    const { getByTestId, getByText } = render(wrap(<AppAlertModal />));

    expect(getByText('Delete Item')).toBeTruthy();
    expect(getByText('Are you sure you want to delete?')).toBeTruthy();

    const deleteBtn = getByTestId('alert-delete-btn');
    const cancelBtn = getByTestId('alert-cancel-btn');

    expect(deleteBtn).toBeTruthy();
    expect(cancelBtn).toBeTruthy();

    fireEvent.press(deleteBtn);
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(useAlertStore.getState().current).toBeNull();
  });

  it('renders 3 buttons vertically for multi-action choices', () => {
    const onPhoto = jest.fn();
    const onGallery = jest.fn();
    const onCancel = jest.fn();

    showAlert(
      'Profile Photo',
      'Choose source',
      [
        { text: 'Take Photo', onPress: onPhoto, testID: 'photo-btn' },
        { text: 'Choose from Library', onPress: onGallery, testID: 'gallery-btn' },
        { text: 'Cancel', style: 'cancel', onPress: onCancel, testID: 'cancel-btn' },
      ],
    );

    const { getByTestId, getByText } = render(wrap(<AppAlertModal />));

    expect(getByText('Profile Photo')).toBeTruthy();
    expect(getByTestId('photo-btn')).toBeTruthy();
    expect(getByTestId('gallery-btn')).toBeTruthy();
    expect(getByTestId('cancel-btn')).toBeTruthy();

    fireEvent.press(getByTestId('photo-btn'));
    expect(onPhoto).toHaveBeenCalledTimes(1);
    expect(useAlertStore.getState().current).toBeNull();
  });

  it('dismisses when backdrop is tapped if cancelable', () => {
    const onCancel = jest.fn();
    showAlert(
      'Confirm',
      'Proceed?',
      [{ text: 'Cancel', style: 'cancel', onPress: onCancel }],
      { cancelable: true },
    );

    const { getByLabelText } = render(wrap(<AppAlertModal />));
    const dismissArea = getByLabelText('Dismiss alert');

    fireEvent.press(dismissArea);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(useAlertStore.getState().current).toBeNull();
  });
});
