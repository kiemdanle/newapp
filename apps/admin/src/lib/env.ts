import { z } from 'zod';

const envSchema = z.object({
  API_BASE_URL: z.string().url(),
  COOKIE_SECURE: z
    .string()
    .transform((v) => v === 'true' || v === '1')
    .default('false'),
  COOKIE_DOMAIN: z.string().optional().default(''),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export interface AdminEnv {
  apiBaseUrl: string;
  cookieSecure: boolean;
  cookieDomain: string | undefined;
  nodeEnv: 'development' | 'test' | 'production';
}

export function parseAdminEnv(source: Record<string, string | undefined>): AdminEnv {
  const e = envSchema.parse(source);
  return {
    apiBaseUrl: e.API_BASE_URL,
    cookieSecure: e.COOKIE_SECURE,
    cookieDomain: e.COOKIE_DOMAIN === '' ? undefined : e.COOKIE_DOMAIN,
    nodeEnv: e.NODE_ENV,
  };
}

let cached: AdminEnv | undefined;
export function getAdminEnv(): AdminEnv {
  if (!cached) cached = parseAdminEnv(process.env as Record<string, string | undefined>);
  return cached;
}
