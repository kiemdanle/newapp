import { z } from 'zod';
import { getPrisma } from '../../db.js';
import {
  featureFlagsSchema,
  moderationSettingsSchema,
  productCreationSettingsSchema,
  pantryUnitsSettingsSchema,
  contributorLevelsSettingSchema,
  photoLimitsSettingsSchema,
  pantryLimitsSettingsSchema,
  pantryLimitsPatchSchema,
  DEFAULT_CONTRIBUTOR_LEVELS,
  DEFAULT_PHOTO_LIMITS,
  DEFAULT_PANTRY_LIMITS,
  type ContributorLevelsSetting,
  type PhotoLimitsSettings,
  type PantryLimitsSettings,
  type PantryLimitsPatch,
} from '@expyrico/shared';
import { writeAuditLog } from '../audit/log.js';

export async function getSetting<T extends z.ZodTypeAny>(key: string, schema: T): Promise<z.infer<T>> {
  const row = await getPrisma().setting.findUnique({ where: { key } });
  if (!row) {
    if (key === SETTING_KEYS.PRODUCT_CREATION) {
      return schema.parse({ mode: 'all' });
    }
    if (key === SETTING_KEYS.PANTRY_UNITS) {
      return schema.parse({ topUnits: ['pcs', 'pack', 'can', 'bottle'] });
    }
    if (key === SETTING_KEYS.CONTRIBUTOR_LEVELS) {
      return schema.parse({ enabled: true, levels: DEFAULT_CONTRIBUTOR_LEVELS });
    }
    if (key === SETTING_KEYS.PHOTO_LIMITS) {
      return schema.parse(DEFAULT_PHOTO_LIMITS);
    }
    if (key === SETTING_KEYS.PANTRY_LIMITS) {
      return schema.parse(DEFAULT_PANTRY_LIMITS);
    }
    throw new Error(`Setting ${key} missing — run seed-admin`);
  }
  return schema.parse(row.value);
}

export async function putSetting<T extends z.ZodTypeAny>(
  key: string,
  value: z.infer<T>,
  schema: T,
  updatedBy: string,
): Promise<z.infer<T>> {
  const parsed = schema.parse(value);
  await getPrisma().setting.upsert({
    where: { key },
    update: { value: parsed as object, updatedBy },
    create: { key, value: parsed as object, updatedBy },
  });
  if (key === SETTING_KEYS.PHOTO_LIMITS) {
    invalidatePhotoLimitsCache();
  }
  if (key === SETTING_KEYS.PANTRY_LIMITS) {
    invalidatePantryLimitsCache();
  }
  return parsed;
}

export const SETTING_KEYS = {
  FEATURE_FLAGS: 'feature_flags',
  MODERATION: 'moderation',
  PRODUCT_CREATION: 'product_creation',
  PANTRY_UNITS: 'pantry_units',
  CONTRIBUTOR_LEVELS: 'contributor_levels',
  PHOTO_LIMITS: 'photo_limits',
  PANTRY_LIMITS: 'pantry_limits',
} as const;

let cachedPhotoLimits: { data: PhotoLimitsSettings; expiresAt: number } | null = null;

export function invalidatePhotoLimitsCache(): void {
  cachedPhotoLimits = null;
}

export async function getPhotoLimits(): Promise<PhotoLimitsSettings> {
  const now = Date.now();
  if (cachedPhotoLimits && cachedPhotoLimits.expiresAt > now) {
    return cachedPhotoLimits.data;
  }
  const fresh = await getSetting(SETTING_KEYS.PHOTO_LIMITS, photoLimitsSettingsSchema);
  cachedPhotoLimits = { data: fresh, expiresAt: now + 60_000 };
  return fresh;
}

let cachedPantryLimits: { data: PantryLimitsSettings; expiresAt: number } | null = null;

export function invalidatePantryLimitsCache(): void {
  cachedPantryLimits = null;
}

export async function getPantryLimits(): Promise<PantryLimitsSettings> {
  const now = Date.now();
  if (cachedPantryLimits && cachedPantryLimits.expiresAt > now) {
    return cachedPantryLimits.data;
  }
  const fresh = await getSetting(SETTING_KEYS.PANTRY_LIMITS, pantryLimitsSettingsSchema);
  cachedPantryLimits = { data: fresh, expiresAt: now + 60_000 };
  return fresh;
}

export async function getPantryLimitsDirect(): Promise<PantryLimitsSettings> {
  const row = await getPrisma().setting.findUnique({ where: { key: SETTING_KEYS.PANTRY_LIMITS } });
  if (!row) return DEFAULT_PANTRY_LIMITS;
  return pantryLimitsSettingsSchema.parse(row.value);
}

export async function updatePantryLimits(
  patch: PantryLimitsPatch,
  adminId: string,
  meta?: { requestId?: string; ip?: string },
): Promise<PantryLimitsSettings> {
  const prisma = getPrisma();
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.setting.findUnique({ where: { key: SETTING_KEYS.PANTRY_LIMITS } });
    const current = row ? pantryLimitsSettingsSchema.parse(row.value) : DEFAULT_PANTRY_LIMITS;

    const merged: PantryLimitsSettings = {
      defaultUserPantryLimit: patch.defaultUserPantryLimit ?? current.defaultUserPantryLimit,
      tierLimits: patch.tierLimits
        ? { ...(current.tierLimits ?? {}), ...patch.tierLimits }
        : current.tierLimits,
    };
    const parsed = pantryLimitsSettingsSchema.parse(merged);

    await tx.setting.upsert({
      where: { key: SETTING_KEYS.PANTRY_LIMITS },
      update: { value: parsed as object, updatedBy: adminId },
      create: { key: SETTING_KEYS.PANTRY_LIMITS, value: parsed as object, updatedBy: adminId },
    });

    await writeAuditLog(
      {
        adminId,
        action: 'settings.pantry_limits.update',
        targetType: 'setting',
        targetId: SETTING_KEYS.PANTRY_LIMITS,
        diff: {
          before: current as unknown as Record<string, unknown>,
          after: parsed as unknown as Record<string, unknown>,
        },
        requestId: meta?.requestId,
        ip: meta?.ip,
      },
      tx,
    );

    return parsed;
  });

  invalidatePantryLimitsCache();
  return updated;
}

export {
  featureFlagsSchema,
  moderationSettingsSchema,
  productCreationSettingsSchema,
  pantryUnitsSettingsSchema,
  contributorLevelsSettingSchema,
  photoLimitsSettingsSchema,
  DEFAULT_PHOTO_LIMITS,
  pantryLimitsSettingsSchema,
  pantryLimitsPatchSchema,
  DEFAULT_PANTRY_LIMITS,
};
export type { ContributorLevelsSetting };
export type { PhotoLimitsSettings };
export type { PantryLimitsSettings, PantryLimitsPatch };