import { describe, expect, it } from 'vitest';
import {
  feedbackReplySchema,
  updateFeedbackStatusSchema,
  adminFeedbackQuerySchema,
} from '@expyrico/shared';

describe('Admin Feedback Actions & Contracts', () => {
  describe('feedbackReplySchema', () => {
    it('accepts trimmed reply message up to 3000 chars', () => {
      const parsed = feedbackReplySchema.parse({
        message: 'We deployed a hotfix in build v1.2.3. Please verify on your device.',
      });
      expect(parsed.message).toBe(
        'We deployed a hotfix in build v1.2.3. Please verify on your device.',
      );
    });

    it('rejects empty or whitespace-only reply', () => {
      expect(() => feedbackReplySchema.parse({ message: '   ' })).toThrow();
      expect(() => feedbackReplySchema.parse({ message: '' })).toThrow();
    });
  });

  describe('updateFeedbackStatusSchema', () => {
    it('accepts valid status changes with resolution notes', () => {
      const parsed = updateFeedbackStatusSchema.parse({
        status: 'resolved',
        resolutionNotes: 'Verified barcode scanner autofocus fix on Android 14.',
      });
      expect(parsed.status).toBe('resolved');
      expect(parsed.resolutionNotes).toBe(
        'Verified barcode scanner autofocus fix on Android 14.',
      );
    });

    it('accepts valid status changes without resolution notes', () => {
      const parsed = updateFeedbackStatusSchema.parse({
        status: 'in_progress',
      });
      expect(parsed.status).toBe('in_progress');
      expect(parsed.resolutionNotes).toBeUndefined();
    });

    it('rejects unknown status transitions', () => {
      expect(() =>
        updateFeedbackStatusSchema.parse({
          status: 'abandoned',
        }),
      ).toThrow();
    });
  });

  describe('adminFeedbackQuerySchema', () => {
    it('parses valid search query with status and type', () => {
      const parsed = adminFeedbackQuerySchema.parse({
        status: 'open',
        type: 'bug',
        search: 'camera',
        limit: 50,
      });
      expect(parsed.status).toBe('open');
      expect(parsed.type).toBe('bug');
      expect(parsed.search).toBe('camera');
      expect(parsed.limit).toBe(50);
    });
  });
});
