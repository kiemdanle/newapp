import { describe, expect, it } from 'vitest';
import {
  adminProductModerateRequestSchema,
  adminProductEditResolveSchema,
  productEditRecoverRequestSchema,
} from '@expyrico/shared';
import { actionErrorMessage } from '@/lib/action-result';

// Pure parsing/formatting logic behind the Phase 6 moderation actions — no
// network, no Next.js request scope. `apiServerFetch` integration is covered by
// admin-api.test.ts; the actual mutation flow is covered by the Playwright
// moderation spec against the mock API.

describe('actionErrorMessage', () => {
  it('renders a fixed, actionable message for version_conflict (never invites blind retry)', () => {
    const msg = actionErrorMessage({ ok: false, code: 'version_conflict' });
    expect(msg).toMatch(/refresh/i);
  });

  it('renders the specific identifier collision for identifier_conflict', () => {
    const msg = actionErrorMessage({
      ok: false,
      code: 'identifier_conflict',
      identifierConflict: { slot: 'barcode', sourceValue: '111', targetValue: '222' },
    });
    expect(msg).toContain('barcode');
    expect(msg).toContain('111');
    expect(msg).toContain('222');
  });

  it('falls back to the server-provided detail for any other code', () => {
    expect(actionErrorMessage({ ok: false, code: 'not_found', detail: 'Revision not found' })).toBe('Revision not found');
  });

  it('falls back to a generic message when no detail is present', () => {
    expect(actionErrorMessage({ ok: false, code: 'internal_error' })).toContain('internal_error');
  });
});

describe('exact decision values enforced by the shared contracts the actions send', () => {
  it('adminProductModerateRequestSchema only accepts approve/request_changes', () => {
    expect(() => adminProductModerateRequestSchema.parse({ decision: 'reject', version: 1 })).toThrow();
    expect(adminProductModerateRequestSchema.parse({ decision: 'approve', version: 1 }).decision).toBe('approve');
  });

  it('adminProductModerateRequestSchema requires a reason when requesting changes', () => {
    expect(() => adminProductModerateRequestSchema.parse({ decision: 'request_changes', version: 1 })).toThrow();
    expect(
      adminProductModerateRequestSchema.parse({ decision: 'request_changes', version: 1, notes: 'fix the name' }).notes,
    ).toBe('fix the name');
  });

  it('adminProductEditResolveSchema requires a reason when requesting changes', () => {
    expect(() => adminProductEditResolveSchema.parse({ decision: 'request_changes' })).toThrow();
    expect(adminProductEditResolveSchema.parse({ decision: 'approve' }).decision).toBe('approve');
  });

  it('productEditRecoverRequestSchema requires desiredPhotoOrder on rebase but rejects it on supersede', () => {
    expect(() =>
      productEditRecoverRequestSchema.parse({ action: 'rebase', editVersion: 1, productVersion: 1 }),
    ).toThrow(); // desiredPhotoOrder is required on the rebase branch
    expect(
      productEditRecoverRequestSchema.parse({ action: 'rebase', editVersion: 1, productVersion: 1, desiredPhotoOrder: [] })
        .action,
    ).toBe('rebase');
    expect(() =>
      productEditRecoverRequestSchema.parse({ action: 'supersede', editVersion: 1, productVersion: 1, desiredPhotoOrder: [] }),
    ).toThrow(); // supersede is `.strict()` and does not accept desiredPhotoOrder
  });

  it('productEditRecoverRequestSchema rejects duplicate desiredPhotoOrder entries on rebase', () => {
    const photoId = '11111111-1111-1111-1111-111111111111';
    expect(() =>
      productEditRecoverRequestSchema.parse({
        action: 'rebase',
        editVersion: 1,
        productVersion: 1,
        desiredPhotoOrder: [
          { type: 'staged', editPhotoId: photoId },
          { type: 'staged', editPhotoId: photoId },
        ],
      }),
    ).toThrow();
  });
});
