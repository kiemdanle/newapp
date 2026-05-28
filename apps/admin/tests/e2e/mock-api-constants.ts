// apps/admin/tests/e2e/mock-api-constants.ts
// Shared constants used by both the mock-api server entry and the spec files.
// Kept in a separate module so importing them does NOT trigger server.listen().

export const E2E_ADMIN_ENROLLED = {
  email: 'enrolled-admin@pantry.local',
  password: 'enrolled-admin-pw-1234',
  totpSecret: 'JBSWY3DPEHPK3PXP', // RFC 4226 vector
};

export const E2E_ADMIN_FRESH = {
  email: 'fresh-admin@pantry.local',
  password: 'fresh-admin-pw-1234',
};

export const ENROLLMENT_SECRET = 'KZXW6YTBOJSXK53PNV2A';

export const ACCESS_TOKEN = 'mock-access-token-enrolled';
export const REFRESH_TOKEN = 'mock-refresh-token-enrolled';
export const CHALLENGE_TOKEN = 'mock-challenge-token-enrolled';
export const ENROLLMENT_CHALLENGE = 'mock-enrollment-challenge-fresh';

export const ENROLLED_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  email: E2E_ADMIN_ENROLLED.email,
  role: 'admin' as const,
  firstName: 'Enrolled',
  lastName: 'Admin',
};

export const FRESH_USER = {
  id: '00000000-0000-0000-0000-000000000002',
  email: E2E_ADMIN_FRESH.email,
  role: 'admin' as const,
  firstName: 'Fresh',
  lastName: 'Admin',
};
