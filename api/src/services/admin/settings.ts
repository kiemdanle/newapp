import { z } from 'zod';
import { getPrisma } from '../../db.js';
import {
  featureFlagsSchema,
  moderationSettingsSchema,
  productCreationSettingsSchema,
  pantryUnitsSettingsSchema,
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
  return parsed;
}

export const SETTING_KEYS = {
  FEATURE_FLAGS: 'feature_flags',
  MODERATION: 'moderation',
  PRODUCT_CREATION: 'product_creation',
  PANTRY_UNITS: 'pantry_units',
} as const;

export {
  featureFlagsSchema,
  moderationSettingsSchema,
  productCreationSettingsSchema,
  pantryUnitsSettingsSchema,
};
