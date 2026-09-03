import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { handleNotificationTap } from '../../src/features/push/handle-notification-open';
import * as navRef from '../../src/navigation/navigationRef';

describe('Push Notification Tap Handler', () => {
  let navigateSpy: any;

  beforeEach(() => {
    navigateSpy = jest.spyOn(navRef, 'navigate').mockImplementation(() => {});
  });

  it('navigates to FeedbackDetail on feedback_reply notification', async () => {
    const result = await handleNotificationTap({
      type: 'feedback_reply',
      ticketId: '11111111-2222-3333-4444-555555555555',
    });

    expect(result).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith('FeedbackDetail', {
      id: '11111111-2222-3333-4444-555555555555',
    });
  });

  it('navigates to FeedbackDetail on feedback_case_resolved notification', async () => {
    const result = await handleNotificationTap({
      type: 'feedback_case_resolved',
      ticketId: '66666666-7777-8888-9999-000000000000',
    });

    expect(result).toBe(true);
    expect(navigateSpy).toHaveBeenCalledWith('FeedbackDetail', {
      id: '66666666-7777-8888-9999-000000000000',
    });
  });

  it('returns false for feedback notification with missing or empty ticketId', async () => {
    const result = await handleNotificationTap({
      type: 'feedback_reply',
      ticketId: '',
    });

    expect(result).toBe(false);
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('returns false for undefined data', async () => {
    const result = await handleNotificationTap(undefined);
    expect(result).toBe(false);
  });
});
