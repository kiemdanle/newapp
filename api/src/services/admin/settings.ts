import { z } from 'zod';
import { getPrisma } from '../../db.js';
import { featureFlagsSchema, moderationSettingsSchema } from '@pantry/shared';

export async function getSetting<T extends z.ZodTypeAny>(key: string, schema: T): Promise<z.infer<T>> {
  const row = await getPrisma().setting.findUnique({ where: { key } });
  if (!row) throw new Error(`Setting ${key} missing — run seed-admin`);
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
} as const;

export { featureFlagsSchema, moderationSettingsSchema };
