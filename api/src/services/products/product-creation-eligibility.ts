// Phase 7: server-authoritative `product_creation` mode gate. `off` blocks every
// mutation listed below for every non-admin actor; `internal` additionally admits
// admins and the environment-managed user-ID allowlist; `all` admits everyone.
// Existing drafts stay readable in every mode — this only ever gates a *mutation*
// call site, never a read/list/export path.
import { ERROR_CODES } from '@expyrico/shared';
import { AppError } from '../../errors.js';
import { getConfig } from '../../config.js';
import { getSetting, SETTING_KEYS, productCreationSettingsSchema } from '../admin/settings.js';
import type { ProductActor } from './product-visibility.js';

export type ProductCreationOperation = 'create' | 'metadata' | 'photo' | 'submit';

const OPERATION_TITLES: Record<ProductCreationOperation, string> = {
  create: 'Creating new products is not yet available',
  metadata: 'Editing this draft is not yet available',
  photo: 'Adding or changing photos on this draft is not yet available',
  submit: 'Product submission is not yet available',
};

async function currentMode(): Promise<'off' | 'internal' | 'all'> {
  const { mode } = await getSetting(SETTING_KEYS.PRODUCT_CREATION, productCreationSettingsSchema);
  return mode;
}

function isInternalCohort(actor: ProductActor): boolean {
  if (actor.role === 'admin') return true;
  return getConfig().productCreation.internalAllowlist.includes(actor.id);
}

/** The actor-specific boolean the lookup-v2 `canCreate` field and any future
 * capability endpoint expose — never the allowlist or the raw mode itself. */
export async function isProductCreationEligible(actor: ProductActor): Promise<boolean> {
  const mode = await currentMode();
  if (mode === 'all') return true;
  if (mode === 'internal') return isInternalCohort(actor);
  return false;
}

/** Throws a typed 403 `feature_disabled` when the actor is not eligible for
 * `operation` under the current mode. Only ever call this from the four
 * private new-product draft mutation call sites (create/metadata/photo/submit)
 * — never from active-product revision routes or admin moderation routes,
 * both of which remain available in every mode. */
export async function assertProductCreationEligible(
  actor: ProductActor,
  operation: ProductCreationOperation,
): Promise<void> {
  if (await isProductCreationEligible(actor)) return;
  throw new AppError({
    status: 403,
    code: ERROR_CODES.FEATURE_DISABLED,
    title: OPERATION_TITLES[operation],
  });
}
