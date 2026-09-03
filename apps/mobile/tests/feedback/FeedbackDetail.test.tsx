import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../helpers/renderWithTheme';
import { FeedbackMessageBubble } from '../../app/(app)/feedback/components/FeedbackMessageBubble';
import FeedbackDetailScreen from '../../app/(app)/feedback/[id]';
import * as feedbackApi from '../../src/api/feedback';
import type { FeedbackMessage, FeedbackTicketDetail } from '@expyrico/shared';

// Mock react-navigation hooks
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: () => ({
      navigate: jest.fn(),
      push: jest.fn(),
      goBack: mockGoBack,
    }),
    useRoute: () => ({
      params: { id: 'test-ticket-id-1234' },
    }),
  };
});

describe('Feedback Detail & Conversation UI', () => {
  describe('FeedbackMessageBubble', () => {
    it('renders admin message with Support Team badge', () => {
      const msg: FeedbackMessage = {
        id: 'msg-admin-1',
        ticketId: 'test-ticket-id-1234',
        senderType: 'admin',
        senderUserId: 'admin-user-id',
        message: 'We deployed a hotfix in build v1.2.3.',
        createdAt: '2026-09-03T11:00:00.000Z',
      };

      const { getByText } = renderWithTheme(
        <FeedbackMessageBubble message={msg} />,
        'expyrico',
      );

      expect(getByText('Support Team')).toBeTruthy();
      expect(getByText('We deployed a hotfix in build v1.2.3.')).toBeTruthy();
    });

    it('renders user message with user attribution', () => {
      const msg: FeedbackMessage = {
        id: 'msg-user-1',
        ticketId: 'test-ticket-id-1234',
        senderType: 'user',
        senderUserId: 'user-id',
        message: 'Camera scanner lens still locks occasionally.',
        createdAt: '2026-09-03T10:30:00.000Z',
      };

      const { getByText } = renderWithTheme(
        <FeedbackMessageBubble message={msg} userName="Alice" />,
        'expyrico',
      );

      expect(getByText('Alice')).toBeTruthy();
      expect(getByText('Camera scanner lens still locks occasionally.')).toBeTruthy();
    });
  });

  describe('FeedbackDetailScreen', () => {
    it('renders ticket details, messages thread, and composer', async () => {
      const mockTicket: FeedbackTicketDetail = {
        id: 'test-ticket-id-1234',
        userId: 'user-id',
        type: 'bug',
        title: 'Scanner lens blur issue',
        description: 'Autofocus locks up when focusing near barcodes',
        status: 'in_progress',
        createdAt: '2026-09-03T10:00:00.000Z',
        updatedAt: '2026-09-03T10:00:00.000Z',
        attachments: [],
        messages: [
          {
            id: 'm1',
            ticketId: 'test-ticket-id-1234',
            senderType: 'user',
            senderUserId: 'user-id',
            message: 'Autofocus locks up when focusing near barcodes',
            createdAt: '2026-09-03T10:00:00.000Z',
          },
          {
            id: 'm2',
            ticketId: 'test-ticket-id-1234',
            senderType: 'admin',
            senderUserId: 'admin-id',
            message: 'We are investigating this now.',
            createdAt: '2026-09-03T10:15:00.000Z',
          },
        ],
      };

      jest.spyOn(feedbackApi, 'fetchFeedbackTicketDetail').mockResolvedValue(mockTicket);
      const sendSpy = jest.spyOn(feedbackApi, 'sendFeedbackReply').mockResolvedValue({
        id: 'm3',
        ticketId: 'test-ticket-id-1234',
        senderType: 'user',
        senderUserId: 'user-id',
        message: 'Thank you!',
        createdAt: '2026-09-03T10:20:00.000Z',
      });

      const { findByText, getByPlaceholderText } = renderWithTheme(
        <FeedbackDetailScreen />,
        'expyrico',
      );

      expect(await findByText('Scanner lens blur issue')).toBeTruthy();
      expect(await findByText('Support Team')).toBeTruthy();
      expect(await findByText('We are investigating this now.')).toBeTruthy();

      const input = getByPlaceholderText('Type your response to support...');
      fireEvent.changeText(input, 'Thank you!');
    });

    it('renders resolution banner and disables composer on resolved ticket', async () => {
      const mockResolvedTicket: FeedbackTicketDetail = {
        id: 'test-ticket-id-1234',
        userId: 'user-id',
        type: 'suggestion',
        title: 'Add dark mode',
        description: 'Please add dark mode.',
        status: 'resolved',
        resolutionNotes: 'Shipped in v1.3.0!',
        resolvedAt: '2026-09-03T11:00:00.000Z',
        createdAt: '2026-09-03T10:00:00.000Z',
        updatedAt: '2026-09-03T11:00:00.000Z',
        attachments: [],
        messages: [],
      };

      jest.spyOn(feedbackApi, 'fetchFeedbackTicketDetail').mockResolvedValue(mockResolvedTicket);

      const { findByText, queryByPlaceholderText } = renderWithTheme(
        <FeedbackDetailScreen />,
        'expyrico',
      );

      expect(await findByText('Case Resolved')).toBeTruthy();
      expect(await findByText('Shipped in v1.3.0!')).toBeTruthy();
      expect(queryByPlaceholderText('Type your response to support...')).toBeNull();
    });
  });
});
