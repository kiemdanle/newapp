import { z } from 'zod';

export const giveawayDistanceSettingsSchema = z.object({
  defaultRadiusKm: z.number().int().min(5).max(200).default(25),
  strictDistanceOnly: z.boolean().default(false),
  allowUserRadiusOverride: z.boolean().default(true),
});

export type GiveawayDistanceSettings = z.infer<typeof giveawayDistanceSettingsSchema>;

export const DEFAULT_GIVEAWAY_DISTANCE_SETTINGS: GiveawayDistanceSettings = {
  defaultRadiusKm: 25,
  strictDistanceOnly: false,
  allowUserRadiusOverride: true,
};
