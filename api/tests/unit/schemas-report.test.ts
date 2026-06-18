import { describe, expect, it } from 'vitest';
import {
  reportCreateSchema,
  reportReasonSchema,
  reportSchema,
  reportStatusSchema,
  reportTargetTypeSchema,
} from '@expyrico/shared';

describe('reportTargetTypeSchema', () => {
  it('accepts review|user|product', () => {
    for (const t of ['review', 'user', 'product'] as const) {
      expect(reportTargetTypeSchema.parse(t)).toBe(t);
    }
  });

  it('rejects unknown target types', () => {
    expect(() => reportTargetTypeSchema.parse('comment')).toThrow();
  });
});

describe('reportReasonSchema', () => {
  it('accepts spam|abuse|incorrect|other', () => {
    for (const r of ['spam', 'abuse', 'incorrect', 'other'] as const) {
      expect(reportReasonSchema.parse(r)).toBe(r);
    }
  });

  it('rejects unknown reasons', () => {
    expect(() => reportReasonSchema.parse('rude')).toThrow();
  });
});

describe('reportStatusSchema', () => {
  it('accepts open|resolved|dismissed', () => {
    for (const s of ['open', 'resolved', 'dismissed'] as const) {
      expect(reportStatusSchema.parse(s)).toBe(s);
    }
  });

  it('rejects unknown statuses', () => {
    expect(() => reportStatusSchema.parse('pending')).toThrow();
  });
});

describe('reportCreateSchema', () => {
  it('accepts the canonical body', () => {
    const r = reportCreateSchema.parse({
      targetType: 'review',
      targetId: '00000000-0000-0000-0000-0000000000aa',
      reason: 'spam',
      body: 'looks fishy',
    });
    expect(r.targetType).toBe('review');
    expect(r.body).toBe('looks fishy');
  });

  it('accepts a missing body (optional)', () => {
    const r = reportCreateSchema.parse({
      targetType: 'user',
      targetId: '00000000-0000-0000-0000-0000000000aa',
      reason: 'abuse',
    });
    expect(r.body).toBeUndefined();
  });

  it('rejects body over 1000 chars', () => {
    expect(() =>
      reportCreateSchema.parse({
        targetType: 'review',
        targetId: '00000000-0000-0000-0000-0000000000aa',
        reason: 'other',
        body: 'x'.repeat(1001),
      }),
    ).toThrow();
  });

  it('rejects non-uuid targetId', () => {
    expect(() =>
      reportCreateSchema.parse({
        targetType: 'review',
        targetId: 'not-a-uuid',
        reason: 'spam',
      }),
    ).toThrow();
  });

  it('rejects unknown reason', () => {
    expect(() =>
      reportCreateSchema.parse({
        targetType: 'review',
        targetId: '00000000-0000-0000-0000-0000000000aa',
        reason: 'unknown',
      }),
    ).toThrow();
  });
});

describe('reportSchema', () => {
  const base = {
    id: '00000000-0000-0000-0000-0000000000aa',
    reporterId: '00000000-0000-0000-0000-0000000000bb',
    targetType: 'review' as const,
    targetId: '00000000-0000-0000-0000-0000000000cc',
    reason: 'spam' as const,
    body: null,
    status: 'open' as const,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('parses an open report payload', () => {
    expect(reportSchema.parse(base).status).toBe('open');
  });

  it('rejects when body is undefined (server returns null)', () => {
    const { body, ...rest } = base;
    void body;
    expect(() => reportSchema.parse(rest)).toThrow();
  });
});
