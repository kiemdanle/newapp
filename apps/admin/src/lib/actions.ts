'use server';
// Server actions for every admin mutation. Each runs through `serverAdminApi`
// (cookie -> Bearer to the Fastify API, which audit-logs the mutation), then
// `revalidatePath` so the affected list/detail re-renders with fresh data.
import { revalidatePath } from 'next/cache';
import { serverAdminApi } from './admin-api';

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

// --- Products ---
export async function patchProductAction(id: string, body: Record<string, unknown>) {
  await serverAdminApi.products.patch(id, body);
  revalidatePath('/products');
  revalidatePath(`/products/${id}`);
}

export async function mergeProductsAction(winnerId: string, loserIds: string[]) {
  await serverAdminApi.products.merge(winnerId, loserIds);
  revalidatePath('/products');
}

export async function resolveProductEditAction(
  id: string,
  decision: 'approve' | 'reject',
  notes?: string,
) {
  await serverAdminApi.products.resolveEdit(id, decision, notes);
  revalidatePath('/products/pending');
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
