import { z } from 'zod';
export declare const giveawayDistanceSettingsSchema: z.ZodObject<{
    defaultRadiusKm: z.ZodDefault<z.ZodNumber>;
    strictDistanceOnly: z.ZodDefault<z.ZodBoolean>;
    allowUserRadiusOverride: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    defaultRadiusKm: number;
    strictDistanceOnly: boolean;
    allowUserRadiusOverride: boolean;
}, {
    defaultRadiusKm?: number | undefined;
    strictDistanceOnly?: boolean | undefined;
    allowUserRadiusOverride?: boolean | undefined;
}>;
export type GiveawayDistanceSettings = z.infer<typeof giveawayDistanceSettingsSchema>;
export declare const DEFAULT_GIVEAWAY_DISTANCE_SETTINGS: GiveawayDistanceSettings;
//# sourceMappingURL=giveaway-settings.d.ts.map