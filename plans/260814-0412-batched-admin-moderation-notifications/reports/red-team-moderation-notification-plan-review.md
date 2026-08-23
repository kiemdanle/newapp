# Batched Admin Moderation Notification Plan — Red-Team Review

**Date:** 2026-08-14
**Review scope:** `plan.md` and phases 1–4
**Disposition:** User approved all accepted corrections.

## Accepted findings

1. Submission-event identity must include the post-transition version, not only a product/edit ID; `changes_required -> pending` is a valid resubmission.
2. A stale revision rebase that returns an edit to `pending` is a fresh reviewable arrival and must persist a revision event inside its existing transaction.
3. Delivery claims need token-fenced ownership (`leaseOwner`), renewal, and conditional finalizers to prevent stale workers from overwriting recovered work.
4. BullMQ scheduling needs a lifecycle-managed, DB-authoritative watchdog/poller that also re-upserts the scheduler after Redis restart without process restart.
5. Push requires bounded FCM multicast chunks plus durable per-token attempt/outcome records; one recipient-channel row cannot represent partial success safely.
6. SMTP needs explicit connection/greeting/socket deadlines shorter than the renewable delivery lease.
7. Moderation template validation must be keyed after fetching the target template; global validation would reject existing expiry template placeholders. Moderation templates are bounded plain text only, escaped in HTML, and may not contain links/markup.
8. The server must use the actual `cfg.frontend.adminUrl` configuration shape. Production requires canonical HTTPS, no credentials/fragment, and a matching build-time `MOBILE_ADMIN_URL` trust anchor; development is a narrow explicit exception.
9. Admin authorization must use the current database role (or invalidate tokens on demotion) before the new history surface is exposed.
10. Delivery rows need `completedAt`; terminal history cleanup keeps 90 days and deletes only fully terminal batches.
11. Rollout uses staging migration proof and scheduler-watchdog smoke testing. Application-only rollback is default; additive tables/data remain intact.
12. Durable pipeline health must expose last successful tick/recovery/cleanup, scheduler reconciliation, oldest unbatched-event age, oldest due-delivery age, and delivery counters.

## Rejected finding

- The previous documentation claim that `infra/scripts/deploy-remote.sh` still filters on `@pantry/api` was rejected as stale after source verification. The final plan requires a production-equivalent staging migration proof instead.

## Evidence samples

- Resubmission transitions: `api/src/services/products/product-drafts.ts:305-313`, `api/src/services/products/product-edits.ts:246-251`
- Rebase returns to pending: `api/src/services/products/product-edits.ts:743-756`
- Existing lease fencing: `api/src/services/products/product-media-outbox.ts:57-65`
- Existing startup-only workers: `api/src/workers/runner.ts:15-42`
- Generic template patch ordering: `api/src/routes/admin/settings/notification-templates.ts:15-20`
- Current config path: `api/src/config.ts:167-169`
- Current role authorization: `api/src/plugins/auth.ts:33-53`

## Unresolved questions

None.
