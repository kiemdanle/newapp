import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  adminProductStatusSchema,
  adminProductEditRowSchema,
  productEditStatusSchema,
  adminProductEditResolveSchema,
} from './products.js';

const now = new Date().toISOString();

describe('adminProductStatusSchema', () => {
  it('includes the full product lifecycle', () => {
    for (const status of ['draft', 'pending', 'changes_required', 'active', 'report_hidden', 'merged_into']) {
      expect(adminProductStatusSchema.parse(status)).toBe(status);
    }
  });
});

describe('productEditStatusSchema', () => {
  it('accepts every revision status, preserving rejected as terminal history', () => {
    for (const status of ['draft', 'pending', 'changes_required', 'approved', 'rejected']) {
      expect(productEditStatusSchema.parse(status)).toBe(status);
    }
  });

  it('rejects an unknown status', () => {
    expect(() => productEditStatusSchema.parse('archived')).toThrow();
  });
});

describe('adminProductEditRowSchema', () => {
  it('parses a full revision row with versioning and moderation fields', () => {
    const row = {
      id: randomUUID(),
      productId: randomUUID(),
      submittedBy: randomUUID(),
      proposed: { name: 'New name' },
      status: 'pending',
      version: 2,
      baseProductVersion: 1,
      moderationNotes: null,
      submittedAt: now,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
    };
    expect(adminProductEditRowSchema.parse(row)).toEqual(row);
  });

  it('accepts the draft and changes_required states', () => {
    const base = {
      id: randomUUID(),
      productId: randomUUID(),
      submittedBy: randomUUID(),
      proposed: {},
      version: 1,
      baseProductVersion: 1,
      moderationNotes: 'Please add a photo',
      submittedAt: null,
      resolvedBy: null,
      resolvedAt: null,
      createdAt: now,
    };
    expect(adminProductEditRowSchema.parse({ ...base, status: 'draft' }).status).toBe('draft');
    expect(adminProductEditRowSchema.parse({ ...base, status: 'changes_required' }).status).toBe(
      'changes_required',
    );
  });
});

describe('adminProductEditResolveSchema', () => {
  it('names the admin action request_changes rather than reject', () => {
    expect(adminProductEditResolveSchema.parse({ decision: 'approve' })).toEqual({
      decision: 'approve',
    });
    expect(
      adminProductEditResolveSchema.parse({ decision: 'request_changes', notes: 'fix the title' }),
    ).toEqual({ decision: 'request_changes', notes: 'fix the title' });
  });

  it('rejects the legacy reject decision', () => {
    expect(() => adminProductEditResolveSchema.parse({ decision: 'reject' })).toThrow();
  });

  it('requires notes when requesting changes', () => {
    expect(() => adminProductEditResolveSchema.parse({ decision: 'request_changes' })).toThrow();
  });
});
