# Build Order — Backend + Admin First (2026-05-26)

Authoritative execution sequence for the Pantry app plans. The project is built in **two tracks**: the entire **Backend + Admin track (Track A)** is implemented, tested, and deployable before **any** mobile work (**Track B**) begins. This is dependency-sound — backend/admin never depend on the mobile app; the mobile app depends on the API.

Each milestone plan carries its own `## Execution order — backend-first (2026-05-26)` header listing which of its phases belong to which track. The vertical milestones (M1, M2, M5–M8) are split: their backend/admin phases run in Track A; their mobile phases are deferred to Track B.

---

## Track A — Backend + Admin (build & deploy first)

| Order | Milestone | Scope in Track A |
|-------|-----------|------------------|
| A1 | **M0a** — Foundation | Entire plan (monorepo, shared Zod, theme tokens, Fastify skeleton, auth services) |
| A2 | **M0b** — API auth routes | Entire plan (register/login/refresh/me/verify/forgot/oauth/passkey/TOTP + admin TOTP enrollment) |
| A3 | **M0d** — Admin shell + infra + deploy | Entire plan (Next.js admin shell + login/TOTP/CSRF, Ansible/systemd/nginx, deploy pipeline, backups). **Backend + admin become deployable here.** |
| A4 | **M1** — Personal pantry | Backend phases **A–I** + backend final-verification (products/records/queues/workers/push API). Mobile phases J–Q → Track B. |
| A5 | **M2** — Reviews + voting | Backend phases **A–H** + API verification (reviews/votes/reports/Wilson/profanity/workers). Mobile phases I–L → Track B. |
| A6 | **M3** — Admin dashboard | Entire plan (all `/v1/admin/*` endpoints + admin web pages). Runs after M1/M2 backend. |
| A7 | **M5** — Deal sharing | Backend + admin phases (data, repo, routes, admin moderation). Mobile feed screen → Track B. |
| A8 | **M6** — Blessing/giveaway | Backend + admin phases (A–G, I). Mobile screens (H) → Track B. |
| A9 | **M7** — Referral + app sharing | Backend + admin phases (data, services, register/conversion hooks, admin overview). Mobile Invite/share/points screens → Track B. |
| A10 | **M8** — Household sharing | Backend + admin phases (households API, records migration + scoping, server-side sync policy, admin management). Mobile household UI → Track B. |

At the end of Track A: the full API + web admin dashboard are implemented, tested, and deployed on the VPS. No mobile app exists yet.

## Track B — Mobile (after the entire Track A is complete & deployed)

| Order | Milestone | Scope in Track B |
|-------|-----------|------------------|
| B1 | **M0c** — Mobile shell + auth + theme | Entire plan (Expo shell, auth flow against the live API, theme switcher). First mobile work. |
| B2 | **M1** — Personal pantry | Mobile phases **J–Q** (WatermelonDB, sync engine, hooks, OCR/scan, record UI, screens, push registration, Maestro). |
| B3 | **M2** — Reviews + voting | Mobile phases **I–L** (review hooks, components, screens, Maestro). |
| B4 | **M5** — Deal sharing | Mobile deals feed/detail/post screens. |
| B5 | **M6** — Blessing/giveaway | Mobile giveaway screens. |
| B6 | **M7** — Referral + app sharing | Mobile Invite screen, share sheet, points/badges display, deep-link capture. |
| B7 | **M8** — Household sharing | Mobile household settings UI, scope toggle, invite-request flow. |
| B8 | **M4** — Polish + launch | Entire plan (3 secondary themes, WCAG AA pass, EAS build/update, store submission, launch runbooks). Final milestone. |

---

## Why this order is dependency-safe

- **M0d/M3 (admin)** consume only backend auth + API contracts, never the mobile app → safe in Track A.
- **M1/M2/M5–M8 mobile phases** consume the backend API + the M0c mobile shell → all their dependencies exist before Track B starts.
- **M4** depends on every mobile screen → last in Track B.
- The mockup prototype (`2026-05-24-mobile-mockup-prototype.md`) is standalone and may be built anytime (it informs Track B UI).

## Notes
- Cook each milestone by following its `## Execution order` header: in Track A, build only that milestone's Track-A phases and skip the deferred mobile phases; in Track B, resume the deferred phases.
- Within a vertical milestone, Track-A phases already precede Track-B phases in file order, so no phase was reordered — only an execution header was added.
- Final-verification phases that contain both API and mobile checks are split per-track (API/admin checks in Track A, mobile checks in Track B), as annotated in each plan.
