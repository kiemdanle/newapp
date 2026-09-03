import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createFeedbackTicketSchema,
  feedbackReplySchema,
  updateFeedbackStatusSchema,
  feedbackDeviceInfoSchema,
  feedbackTicketSchema,
  feedbackTicketDetailSchema,
  feedbackAttachmentSchema,
  feedbackMessageSchema,
  feedbackListQuerySchema,
} from './feedback.js';
import {
  adminFeedbackQuerySchema,
  adminFeedbackRowSchema,
  adminFeedbackCountsSchema,
} from './admin/feedback.js';

describe('Feedback Schemas', () => {
  describe('createFeedbackTicketSchema', () => {
    it('accepts valid bug report with full fields', () => {
      const input = {
        type: 'bug',
        title: 'Scanner freezes on barcode scan',
        description: 'When tapping scan on Android 14, camera preview opens but frame locks after 2 seconds.',
        attachmentIds: [randomUUID(), randomUUID()],
        deviceInfo: {
          platform: 'android',
          osVersion: '14',
          appVersion: '1.2.0',
          deviceModel: 'Pixel 8',
        },
      };

      const parsed = createFeedbackTicketSchema.parse(input);
      expect(parsed.type).toBe('bug');
      expect(parsed.attachmentIds).toHaveLength(2);
      expect(parsed.deviceInfo?.platform).toBe('android');
    });

    it('accepts minimal suggestion without attachments or device info', () => {
      const input = {
        type: 'suggestion',
        title: 'Add dark mode toggle to quick settings',
        description: 'It would be great to quickly toggle dark mode from the pantry header.',
      };

      const parsed = createFeedbackTicketSchema.parse(input);
      expect(parsed.type).toBe('suggestion');
      expect(parsed.attachmentIds).toEqual([]);
      expect(parsed.deviceInfo).toBeUndefined();
    });

    it('rejects title shorter than 3 characters', () => {
      expect(() =>
        createFeedbackTicketSchema.parse({
          type: 'feedback',
          title: 'Hi',
          description: 'This is a valid long description for feedback.',
        }),
      ).toThrow();
    });

    it('rejects description shorter than 10 characters', () => {
      expect(() =>
        createFeedbackTicketSchema.parse({
          type: 'feedback',
          title: 'Valid title',
          description: 'Too short',
        }),
      ).toThrow();
    });

    it('rejects more than 5 attachments', () => {
      expect(() =>
        createFeedbackTicketSchema.parse({
          type: 'bug',
          title: 'Too many files',
          description: 'This ticket includes more than the allowed five attachments.',
          attachmentIds: [
            randomUUID(),
            randomUUID(),
            randomUUID(),
            randomUUID(),
            randomUUID(),
            randomUUID(),
          ],
        }),
      ).toThrow();
    });

    it('rejects unknown feedback types', () => {
      expect(() =>
        createFeedbackTicketSchema.parse({
          type: 'complaint',
          title: 'Valid title',
          description: 'This is a valid long description for feedback.',
        }),
      ).toThrow();
    });
  });

  describe('feedbackReplySchema', () => {
    it('accepts valid non-empty reply', () => {
      const parsed = feedbackReplySchema.parse({ message: 'Thank you for looking into this!' });
      expect(parsed.message).toBe('Thank you for looking into this!');
    });

    it('rejects empty or whitespace-only message', () => {
      expect(() => feedbackReplySchema.parse({ message: '' })).toThrow();
      expect(() => feedbackReplySchema.parse({ message: '   ' })).toThrow();
    });
  });

  describe('updateFeedbackStatusSchema', () => {
    it('accepts valid status and resolution notes', () => {
      const parsed = updateFeedbackStatusSchema.parse({
        status: 'resolved',
        resolutionNotes: 'Fixed in app release v1.2.1.',
      });
      expect(parsed.status).toBe('resolved');
      expect(parsed.resolutionNotes).toBe('Fixed in app release v1.2.1.');
    });

    it('accepts status without resolution notes', () => {
      const parsed = updateFeedbackStatusSchema.parse({ status: 'in_progress' });
      expect(parsed.status).toBe('in_progress');
      expect(parsed.resolutionNotes).toBeUndefined();
    });

    it('rejects invalid status enum', () => {
      expect(() => updateFeedbackStatusSchema.parse({ status: 'pending' })).toThrow();
    });
  });

  describe('feedbackDeviceInfoSchema', () => {
    it('accepts valid device information', () => {
      const parsed = feedbackDeviceInfoSchema.parse({
        platform: 'ios',
        osVersion: '17.5.1',
        appVersion: '1.0.4',
        deviceModel: 'iPhone 15 Pro',
      });
      expect(parsed.platform).toBe('ios');
      expect(parsed.deviceModel).toBe('iPhone 15 Pro');
    });

    it('rejects invalid platform', () => {
      expect(() =>
        feedbackDeviceInfoSchema.parse({
          platform: 'windows',
          osVersion: '11',
          appVersion: '1.0.0',
        }),
      ).toThrow();
    });
  });

  describe('Admin Feedback Schemas', () => {
    it('adminFeedbackQuerySchema applies default limit', () => {
      const parsed = adminFeedbackQuerySchema.parse({});
      expect(parsed.limit).toBe(25);
      expect(parsed.status).toBeUndefined();
      expect(parsed.search).toBeUndefined();
    });

    it('adminFeedbackCountsSchema validates aggregate numbers', () => {
      const parsed = adminFeedbackCountsSchema.parse({
        total: 10,
        open: 4,
        inProgress: 2,
        replied: 1,
        resolved: 2,
        closed: 1,
      });
      expect(parsed.total).toBe(10);
      expect(parsed.open).toBe(4);
    });
  });
});
