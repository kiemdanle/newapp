import { z } from 'zod';
import { getPrisma } from '../../db.js';
import {
  featureFlagsSchema,
  moderationSettingsSchema,
  productCreationSettingsSchema,
  pantryUnitsSettingsSchema,
  contributorLevelsSettingSchema,
  photoLimitsSettingsSchema,
  DEFAULT_CONTRIBUTOR_LEVELS,
  DEFAULT_PHOTO_LIMITS,
  type ContributorLevelsSetting,
  type PhotoLimitsSettings,
} from '@expyrico/shared';

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
  return parsed;
}

export const SETTING_KEYS = {
  FEATURE_FLAGS: 'feature_flags',
  MODERATION: 'moderation',
  PRODUCT_CREATION: 'product_creation',
  PANTRY_UNITS: 'pantry_units',
  CONTRIBUTOR_LEVELS: 'contributor_levels',
  PHOTO_LIMITS: 'photo_limits',
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

export {
  featureFlagsSchema,
  moderationSettingsSchema,
  productCreationSettingsSchema,
  pantryUnitsSettingsSchema,
  contributorLevelsSettingSchema,
  photoLimitsSettingsSchema,
  DEFAULT_PHOTO_LIMITS,
};
export type { ContributorLevelsSetting };
export type { PhotoLimitsSettings };
