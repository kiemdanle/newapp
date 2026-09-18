---
title: "Security Hardening: Next.js RCE Fix, CSPRNG Admin Credentials, and CORS Whitelist"
date: 2026-09-18
summary: "Patched Next.js 15.5.25 for libheif RCE in apps/admin, replaced Math.random with crypto.randomBytes for admin passwords, and updated CORS deep-link origin whitelist"
---

# Security Hardening: Next.js RCE Fix, CSPRNG Admin Credentials, and CORS Whitelist

Patched Next.js 15.5.25 for libheif RCE in apps/admin, replaced Math.random with crypto.randomBytes for admin passwords, and updated CORS deep-link origin whitelist.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.

## Vulnerabilities Fixed
1. **Critical: Next.js Image Optimization RCE (`GHSA-2xp9-vwfh-vxw4`)**:
   - Upgraded `next` and `eslint-config-next` from `15.5.19` to `15.5.25` in `apps/admin/package.json`.
   - Patched underlying libheif/sharp buffer processing vulnerability during AVIF image processing.
2. **Medium: Insecure Randomness in Admin Password Generation**:
   - Replaced `Math.random().toString(36)...` in `api/src/routes/admin/settings/admins.ts:26` with native Node.js CSPRNG `randomBytes(24).toString('base64url')`.
3. **Medium: CORS Origin Deep-Link Whitelist**:
   - Updated `api/src/plugins/cors.ts:12` to whitelist `expyrico://` while removing deprecated legacy schemes `pantry://`.
4. **High: Transitive `js-yaml` CPU Denial of Service (`CVE-2026-84375`)**:
   - Added `pnpm.overrides` for `"js-yaml": "^4.3.2"` in root `package.json` to resolve transitive merge-key CPU exhaustion.

## Verification & Deployment
- `pnpm --filter @expyrico/admin typecheck` and `pnpm --filter @expyrico/admin test` passed (19 test files, 93 tests).
- `pnpm --filter @expyrico/admin build` generated standalone bundle in 28 seconds without errors.
- `pnpm --filter api typecheck` passed with 0 errors.
- Commits pushed to `origin/main` (`a87f867`), pulled to `api.linhkienkts.com`.
- `pantry-api` and `pantry-admin` restarted via systemd and verified active.
