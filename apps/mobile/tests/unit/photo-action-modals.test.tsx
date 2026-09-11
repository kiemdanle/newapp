import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { PhotoSourcePickerModal } from '../../src/components/PhotoSourcePickerModal';
import { DeletePhotoConfirmModal } from '../../src/components/DeletePhotoConfirmModal';
import { PhotoLimitModal } from '../../src/components/PhotoLimitModal';

describe('Photo Action Modals (Expyrico Palette & Design System)', () => {
  describe('PhotoSourcePickerModal', () => {
    it('renders options for cover photo replacement with custom title and callbacks', () => {
      const onTake = jest.fn();
      const onGallery = jest.fn();
      const onClose = jest.fn();

      const { getByTestId, getByText } = renderWithTheme(
        <PhotoSourcePickerModal
          visible={true}
          title="Change Cover Photo"
          subtitle="Choose how you want to update this photo"
          onClose={onClose}
          onTakePhoto={onTake}
          onChooseGallery={onGallery}
        />,
        'expyrico',
      );

      expect(getByTestId('photo-source-picker-modal')).toBeTruthy();
      expect(getByText('Change Cover Photo')).toBeTruthy();
      expect(getByText('Take Photo')).toBeTruthy();
      expect(getByText('Choose from Gallery')).toBeTruthy();

      fireEvent.press(getByTestId('photo-source-take-photo-btn'));
      expect(onTake).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);

      fireEvent.press(getByTestId('photo-source-gallery-btn'));
      expect(onGallery).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(2);

      fireEvent.press(getByTestId('photo-source-cancel-btn'));
      expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('renders default Add Item Photo title and options in dark theme', () => {
      const onTake = jest.fn();
      const onGallery = jest.fn();
      const onClose = jest.fn();

      const { getByText } = renderWithTheme(
        <PhotoSourcePickerModal
          visible={true}
          onClose={onClose}
          onTakePhoto={onTake}
          onChooseGallery={onGallery}
        />,
        'expyricoDark',
      );

      expect(getByText('Add Item Photo')).toBeTruthy();
      expect(getByText('Take Photo')).toBeTruthy();
    });
  });

  describe('DeletePhotoConfirmModal', () => {
    it('triggers onConfirmDelete when user confirms deletion', () => {
      const onDelete = jest.fn();
      const onClose = jest.fn();

      const { getByTestId, getByText } = renderWithTheme(
        <DeletePhotoConfirmModal
          visible={true}
          onClose={onClose}
          onConfirmDelete={onDelete}
        />,
        'expyrico',
      );

      expect(getByTestId('delete-photo-confirm-modal')).toBeTruthy();
      expect(getByText('Delete Photo?')).toBeTruthy();
      expect(getByText('Delete')).toBeTruthy();

      fireEvent.press(getByTestId('delete-photo-confirm-btn'));
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('triggers onClose when user cancels deletion in dark theme', () => {
      const onDelete = jest.fn();
      const onClose = jest.fn();

      const { getByTestId } = renderWithTheme(
        <DeletePhotoConfirmModal
          visible={true}
          onClose={onClose}
          onConfirmDelete={onDelete}
        />,
        'expyricoDark',
      );

      fireEvent.press(getByTestId('delete-photo-cancel-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onDelete).not.toHaveBeenCalled();
    });
  });

  describe('PhotoLimitModal', () => {
    it('renders photo limit warning with max count and close button', () => {
      const onClose = jest.fn();

      const { getByTestId, getByText } = renderWithTheme(
        <PhotoLimitModal
          visible={true}
          maxPhotos={5}
          onClose={onClose}
        />,
        'expyrico',
      );

      expect(getByTestId('photo-limit-modal')).toBeTruthy();
      expect(getByText('Photo Limit Reached')).toBeTruthy();
      expect(getByText(/You can attach up to 5 photos/)).toBeTruthy();

      fireEvent.press(getByTestId('photo-limit-ok-btn'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
