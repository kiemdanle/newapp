import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { FeedbackTypeSelector } from '../../app/(app)/feedback/components/FeedbackTypeSelector';
import { FeedbackTicketCard } from '../../app/(app)/feedback/components/FeedbackTicketCard';
import FeedbackHubScreen from '../../app/(app)/feedback/index';
import type { FeedbackTicket } from '@expyrico/shared';

// Mock photo picker
jest.mock('../../src/features/products/photo-picker-adapter', () => ({
  takePhoto: jest.fn(),
  choosePhotos: jest.fn(),
  handlePhotoPickerError: jest.fn(),
}));

// Mock react-navigation hooks
const mockNavigate = jest.fn();
const mockPush = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: mockNavigate,
      push: mockPush,
      goBack: jest.fn(),
    }),
    useRoute: () => ({
      params: { initialTab: 'submit' },
    }),
  };
});

describe('Mobile Feedback UI Components', () => {
  describe('FeedbackTypeSelector', () => {
    it('renders all 3 types and triggers onChange when tapped', () => {
      const onChange = jest.fn();
      const { getByTestId, getByText } = renderWithTheme(
        <FeedbackTypeSelector value="bug" onChange={onChange} />,
        'expyrico',
      );

      expect(getByText('SUBMISSION TYPE')).toBeTruthy();
      expect(getByText('Report Bug')).toBeTruthy();
      expect(getByText('Suggestion')).toBeTruthy();
      expect(getByText('Feedback')).toBeTruthy();

      fireEvent.press(getByTestId('feedback-type-suggestion'));
      expect(onChange).toHaveBeenCalledWith('suggestion');
    });
  });

  describe('FeedbackTicketCard', () => {
    it('renders ticket title, status pill, and triggers onPress', () => {
      const ticket: FeedbackTicket = {
        id: '11111111-1111-1111-1111-111111111111',
        userId: '22222222-2222-2222-2222-222222222222',
        type: 'bug',
        title: 'Scanner lens blur issue',
        description: 'Autofocus locks up when focusing near barcodes',
        status: 'open',
        createdAt: '2026-09-03T10:00:00.000Z',
        updatedAt: '2026-09-03T10:00:00.000Z',
      };
      const onPress = jest.fn();

      const { getByText, getByTestId } = renderWithTheme(
        <FeedbackTicketCard ticket={ticket} onPress={onPress} />,
        'expyrico',
      );

      expect(getByText('Scanner lens blur issue')).toBeTruthy();
      expect(getByText('Open')).toBeTruthy();
      expect(getByText('Bug')).toBeTruthy();

      fireEvent.press(getByTestId(`feedback-ticket-card-${ticket.id}`));
      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });

  describe('FeedbackHubScreen', () => {
    it('renders Submit New tab by default with title and description inputs', () => {
      const { getByTestId, getByText } = renderWithTheme(<FeedbackHubScreen />, 'expyrico');

      expect(getByText('Submit New')).toBeTruthy();
      expect(getByText('My Tickets')).toBeTruthy();
      expect(getByTestId('feedback-title-input')).toBeTruthy();
      expect(getByTestId('feedback-description-input')).toBeTruthy();
      expect(getByTestId('feedback-submit-button')).toBeTruthy();
    });

    it('switches to My Tickets tab on press', () => {
      const { getByTestId, getByText } = renderWithTheme(<FeedbackHubScreen />, 'expyrico');

      fireEvent.press(getByTestId('feedback-tab-tickets'));
      expect(getByText('Loading your tickets…')).toBeTruthy();
    });
  });
});
