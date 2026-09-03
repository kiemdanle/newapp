'use server';
// Server actions for every admin mutation. Each runs through `serverAdminApi`
// (cookie -> Bearer to the Fastify API, which audit-logs the mutation), then
// `revalidatePath` so the affected list/detail re-renders with fresh data.
import { revalidatePath } from 'next/cache';
import type { z } from 'zod';
import { adminProductMergeResponseSchema, adminProductRowSchema } from '@expyrico/shared';
import type {
  AdminProductEditResolveDecision,
  AdminProductModerateDecision,
  Product,
  ProductEditRecoverRequest,
  ProductEditRow,
} from '@expyrico/shared';
import type {
  AdminUserReset2faRequest,
  AdminUserReset2faResponse,
} from '@expyrico/shared';
import type {
  AdminUserChangePasswordRequest,
  AdminUserChangePasswordResponse,
  AdminUserSendRandomPasswordRequest,
  AdminUserSendRandomPasswordResponse,
} from '@expyrico/shared';
import { serverAdminApi } from './admin-api';
import { ApiError } from './api';
import type { ActionResult } from './action-result';

type AdminProductRow = z.infer<typeof adminProductRowSchema>;
type AdminProductMergeResponse = z.infer<typeof adminProductMergeResponseSchema>;

// Runs a Phase 6 moderation mutation and always returns a plain, serializable
// `ActionResult` rather than throwing — see `action-result.ts` for why a thrown
// `ApiError`'s structured fields would not otherwise survive the Server Action
// boundary back to the client.
async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ApiError) {
      return {
        ok: false,
        code: e.code,
        detail: e.detail,
        currentVersion: e.currentVersion,
        identifierConflict: e.identifierConflict,
      };
    }
    return { ok: false, code: 'unknown_error' };
  }
}

// --- Users ---
export async function patchUserAction(id: string, body: Record<string, unknown>) {
  await serverAdminApi.users.patch(id, body);
  revalidatePath('/users');
  revalidatePath(`/users/${id}`);
}

export async function revokeUserSessionsAction(id: string) {
  await serverAdminApi.users.revokeSessions(id);
  revalidatePath(`/users/${id}`);
}

export async function impersonateUserAction(id: string): Promise<{ accessToken: string; expiresIn: number }> {
  return serverAdminApi.users.impersonate(id);
}

export async function resetUser2faAction(
  id: string,
  body?: AdminUserReset2faRequest,
): Promise<ActionResult<AdminUserReset2faResponse>> {
  const result = await runAction(() => serverAdminApi.users.reset2fa(id, body));
  if (result.ok) {
    revalidatePath('/users');
    revalidatePath(`/users/${id}`);
    revalidatePath('/settings/admins');
  }
  return result;
}

export async function changeUserPasswordAction(
  id: string,
  body: AdminUserChangePasswordRequest,
): Promise<ActionResult<AdminUserChangePasswordResponse>> {
  const result = await runAction(() => serverAdminApi.users.changePassword(id, body));
  if (result.ok) {
    revalidatePath('/users');
    revalidatePath(`/users/${id}`);
  }
  return result;
}

export async function sendUserRandomPasswordAction(
  id: string,
  body?: AdminUserSendRandomPasswordRequest,
): Promise<ActionResult<AdminUserSendRandomPasswordResponse>> {
  const result = await runAction(() => serverAdminApi.users.sendRandomPassword(id, body));
  if (result.ok) {
    revalidatePath('/users');
    revalidatePath(`/users/${id}`);
  }
  return result;
}

// --- Products ---
export async function patchProductAction(
  id: string,
  version: number,
  body: Record<string, unknown>,
): Promise<ActionResult<AdminProductRow>> {
  const result = await runAction(() => serverAdminApi.products.patch(id, version, body));
  if (result.ok) {
    revalidatePath('/products');
    revalidatePath(`/products/${id}`);
  }
  return result;
}

export async function mergeProductsAction(
  targetId: string,
  sourceIds: string[],
  version: number,
): Promise<ActionResult<AdminProductMergeResponse>> {
  const result = await runAction(() => serverAdminApi.products.merge(targetId, sourceIds, version));
  if (result.ok) revalidatePath('/products');
  return result;
}

export async function moderateProductAction(
  id: string,
  decision: AdminProductModerateDecision,
  version: number,
  notes?: string,
): Promise<ActionResult<AdminProductRow>> {
  const result = await runAction(() => serverAdminApi.products.moderate(id, decision, version, notes));
  if (result.ok) {
    revalidatePath('/products');
    revalidatePath('/products/pending');
    revalidatePath(`/products/${id}`);
  }
  return result;
}

export async function resolveProductEditAction(
  id: string,
  decision: AdminProductEditResolveDecision,
  notes?: string,
): Promise<ActionResult<Product | ProductEditRow>> {
  const result = await runAction(() => serverAdminApi.products.resolveEdit(id, decision, notes));
  if (result.ok) {
    revalidatePath('/products/pending');
    revalidatePath(`/products/pending/${id}`);
  }
  return result;
}

export async function recoverProductEditAction(
  editId: string,
  input: ProductEditRecoverRequest,
): Promise<ActionResult<ProductEditRow>> {
  const result = await runAction(() => serverAdminApi.products.recoverEdit(editId, input));
  if (result.ok) {
    revalidatePath('/products/pending');
    revalidatePath(`/products/pending/${editId}`);
  }
  return result;
}

// --- Product photos (direct admin correction of a live product's own photo set) ---
export async function reorderProductPhotosAction(
  productId: string,
  photoIds: string[],
): Promise<ActionResult<Product>> {
  const result = await runAction(() => serverAdminApi.products.photos.reorder(productId, photoIds));
  if (result.ok) revalidatePath(`/products/${productId}`);
  return result;
}

export async function removeProductPhotoAction(
  productId: string,
  photoId: string,
): Promise<ActionResult<Product>> {
  const result = await runAction(() => serverAdminApi.products.photos.remove(productId, photoId));
  if (result.ok) revalidatePath(`/products/${productId}`);
  return result;
}

// --- Reviews ---
export async function setReviewStatusAction(id: string, status: 'visible' | 'hidden' | 'deleted') {
  await serverAdminApi.reviews.setStatus(id, status);
  revalidatePath('/reviews');
  revalidatePath(`/reviews/${id}`);
}

// --- Reports ---
export async function resolveReportAction(
  id: string,
  action: 'hide' | 'delete' | 'dismiss' | 'ban',
  notes?: string,
) {
  await serverAdminApi.reports.resolve(id, action, notes);
  revalidatePath('/reports');
  revalidatePath(`/reports/${id}`);
}

// --- Deals ---
export async function setDealStatusAction(id: string, status: 'visible' | 'hidden' | 'deleted') {
  await serverAdminApi.deals.setStatus(id, status);
  revalidatePath('/deals');
}

// --- Giveaways ---
export async function cancelGiveawayAction(id: string) {
  await serverAdminApi.giveaways.cancel(id);
  revalidatePath('/giveaways');
}

// --- Settings ---
export async function saveFeatureFlagsAction(body: {
  reviewsEnabled: boolean;
  passkeysEnabled: boolean;
  ocrEnabled: boolean;
  maintenanceBanner: string | null;
}) {
  await serverAdminApi.settings.featureFlags.put(body);
  revalidatePath('/settings/feature-flags');
}

export async function saveProductCreationAction(body: { mode: 'off' | 'internal' | 'all'; requireApproval?: boolean }) {
  await serverAdminApi.settings.productCreation.patch(body);
  revalidatePath('/settings/feature-flags');
}

export async function saveModerationAction(body: {
  autoHideReportThreshold: number;
  profanitySensitivity: 'low' | 'medium' | 'high';
}) {
  await serverAdminApi.settings.moderation.put(body);
  revalidatePath('/settings/moderation');
}

export async function patchNotificationTemplateAction(
  id: string,
  body: Record<string, unknown>,
) {
  await serverAdminApi.settings.notificationTemplates.patch(id, body);
  revalidatePath('/settings/notification-templates');
}

export async function inviteAdminAction(body: {
  email: string;
  firstName: string;
  lastName: string;
}) {
  await serverAdminApi.settings.admins.invite(body);
  revalidatePath('/settings/admins');
}

export async function revokeAdminAction(id: string) {
  await serverAdminApi.settings.admins.revoke(id);
  revalidatePath('/settings/admins');
}

export async function revokeTrustedDeviceAction(id: string) {
  await serverAdminApi.trustedDevices.revoke(id);
  revalidatePath('/settings/admins');
}
