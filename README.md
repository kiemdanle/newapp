# Pantry

Cross-platform mobile app for tracking product expiry dates with shared product reviews. Self-hosted backend.

## Layout

- `api/` — Fastify backend
- `apps/mobile/` — Expo React Native app
- `apps/admin/` — Next.js admin web UI
- `packages/shared/` — Zod schemas and shared types
- `packages/theme/` — Theme tokens (Aurora, Bento, Clay, Material)
- `infra/` — Ansible provisioning and deploy scripts

## Develop

```sh
pnpm install
pnpm dev
```

## Spec

`docs/superpowers/specs/2026-05-23-pantry-app-design.md`
