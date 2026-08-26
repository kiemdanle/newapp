import { z } from 'zod';
export declare const countryMetadataSchema: z.ZodObject<{
    code: z.ZodString;
    name: z.ZodString;
    flag: z.ZodString;
    locale: z.ZodString;
    currencyCode: z.ZodString;
    currencySymbol: z.ZodString;
    dateFormat: z.ZodEnum<["MDY", "DMY", "YMD"]>;
    is24Hour: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    code: string;
    name: string;
    flag: string;
    locale: string;
    currencyCode: string;
    currencySymbol: string;
    dateFormat: "MDY" | "DMY" | "YMD";
    is24Hour: boolean;
}, {
    code: string;
    name: string;
    flag: string;
    locale: string;
    currencyCode: string;
    currencySymbol: string;
    dateFormat: "MDY" | "DMY" | "YMD";
    is24Hour: boolean;
}>;
export type CountryMetadata = z.infer<typeof countryMetadataSchema>;
/**
 * Lightweight, zero-dependency registry of common countries with regional
 * conventions (locale, currency, date format, clock).
 */
export declare const RECORD_COUNTRIES: Record<string, CountryMetadata>;
export declare const DEFAULT_COUNTRY_METADATA: CountryMetadata;
export declare function getCountryMetadata(countryCode: string | null | undefined): CountryMetadata;
export declare function getAllCountries(): CountryMetadata[];
//# sourceMappingURL=locale.d.ts.map