# M1 Personal Pantry — Plan Validation Report

Plan: `docs/superpowers/plans/2026-05-24-m1-personal-pantry.md` (6687 lines)
Spec: `docs/superpowers/specs/2026-05-23-pantry-app-design.md`
Mode: greenfield (no source to verify against). Read-only/advisory.

---

## 1. CONSUMES list (verbatim from plan Prerequisite, lines 13-20)

> - `@pantry/shared` (Zod schemas)
> - `api/src/server.ts`, `api/src/config.ts`, `api/src/db.ts`, `api/src/redis.ts`, `api/src/errors.ts`
> - `api/src/plugins/auth.ts` (`req.user`, `app.requireAuth`)
> - `api/src/services/users/repository.ts`
> - `api/tests/helpers/setup.ts` and `factories.ts`
> - Mobile: `apps/mobile/src/api/client.ts`, secure session store, theme provider with `useTheme()` from M0c.

### Additional implicit CONSUMES discovered in code bodies (NOT in the Prerequisite list — cross-check against M0a/M0b/M0c)
- `api/src/logger.ts` → `export const logger` (breaker.ts L919, lookup.ts L1352, all workers). NOT listed as prereq. Convention §174 says "use `req.log`"; plan instead imports a module-level `logger`. **Verify M0a exports `logger` from `api/src/logger.ts`.**
- `api/src/services/auth/tokens.ts` → `issueAccessToken({ sub, role })` (every integration test). NOT in prereq list. **Verify M0a provides this exact signature.**
- `AppError` from `api/src/errors.ts` constructed as `new AppError({ status, code, title })` (object form). **Verify M0a's AppError ctor shape matches.**
- `ERROR_CODES` exported from `@pantry/shared` with members `.NOT_FOUND`, `.CONFLICT`, `.VALIDATION`. Tests assert string codes `'not_found'`, `'conflict'`, `'validation_error'`. **Verify M0a's ERROR_CODES values map to those literals** (esp. `VALIDATION` → `'validation_error'`).
- `req.user!.id` and `req.user` (auth plugin). Prereq lists `req.user` + `app.requireAuth` — OK.
- `getPrisma()` from `api/src/db.ts`; `getRedis()` from `api/src/redis.ts`; `getConfig().env` from `api/src/config.ts`. db/redis/config listed; `getConfig().env === 'test'` shape assumed (runner.ts L4440). **Verify config exposes `.env`.**
- M0b `api/src/services/users/country-detect.ts` → `detectCountryFromIp(ip)` (D28, country-suggestion.ts L3899). NOT in prereq list. **Verify M0b provides it** (spec §2.9 implies it exists).
- M0b `api/src/routes/me/index.ts` — plan is ambiguous ("if M0b hasn't already", "inside the /v1/me sub-app … `meScope`"). H2 (L3811) registers `pushTokenRoutes` at prefix `/v1/me` standalone; H3 (L3919) assumes a `meScope` sub-app. **Inconsistent mount strategy for /v1/me — see Risks.**
- Mobile: `apps/mobile/src/auth/secureStorage.js` → `getItem`/`setItem` (sync.ts L4845, registerPushToken.ts L6480). Prereq says "secure session store" — name `secureStorage` assumed. **Verify M0c path/exports.**
- Mobile `useTheme()` imported from `../../theme/useTheme.js` (PrePromptModal L5483, etc.). Prereq says "theme provider with `useTheme()`". Path `src/theme/useTheme` assumed. **Verify M0c export path.** Components consume theme tokens `colors.bgElevated, primaryFg, textInverse, success, warning, danger, border`, `radii.pill/md/lg`, `spacing.xs..xxl`. **Verify M0c theme token shape provides ALL of these** (large surface; high drift risk).
- Mobile `apps/mobile/src/api/client.js` → `apiClient.get/post/patch/delete` with `(url, body, { headers })`. Prereq lists client.ts. **Verify method signatures, esp. 3rd-arg headers option (sync.ts L4749).**
- Mobile `apps/mobile/src/api/me.ts` — H4 MODIFIES it (append `useCountrySuggestion`). Plan lists it as Modify but it's an M0b/M0c file. **Verify it exists.**
- Mobile `apps/mobile/babel.config.js` (J1 L4508) + `apps/mobile/app/_layout.tsx` (K2 L4921) — modified, created in M0c. **Verify present.**

---

## 2. PROVIDES manifest (what M2/M3 consume — captured EXACTLY)

### DB tables (Prisma, `api/prisma/schema.prisma`)
- `products` (`@@map("products")`), `product_edits` (`@@map("product_edits")`), `records` (`@@map("records")`), `push_logs` (`@@map("push_logs")`), plus `push_tokens` platform converted String→`PushPlatform` enum (D27).
- `User.notificationPreferences Json?` added (shape `{ offsetsDays: number[] }`, default null → `[7,1,0]`).
- Enums: `ProductSource(off|upcitemdb|user)`, `ProductStatus(active|pending|merged_into)`, `ProductEditStatus`(`@@map("product_edit_status")`), `RecordStatus(active|consumed|discarded|expired)`, `PushPlatform(ios|android)`, `PushLogStatus`(`@@map("push_log_status")`).
- pg_trgm GIN index `products_name_brand_trgm` on `(coalesce(name,'')||' '||coalesce(brand,''))`.
- Architecture DECISIONS applied consistently: product edits → side table `product_edits` with `proposed Json` + `status` enum (used in D6 PATCH route, M3 handoff). users.notificationPreferences Json (declared, see GAP below). **Both decisions present in schema; notificationPreferences NOT actually read anywhere in M1 — see Gaps.**

### Idempotency plugin — EXACT PATH (M2 cites `api/src/plugins/idempotency.ts`)
- File: `api/src/plugins/idempotency.ts` ✅ matches M2 claim.
- Export: `export const idempotencyPlugin = fp(async (app) => {...})` (fastify-plugin wrapped).
- Mechanism: route `config: { idempotent: boolean | 'required' }` via `FastifyContextConfig` declaration-merge. Redis key `idem:${path}:${key}`, TTL `86400`s (24h). Replays cached `{status, body, contentType}`.
- `POST /v1/records` uses `config: { idempotent: 'required' }`.

### BullMQ wiring — EXACT PATHS/EXPORTS (M2 cites these)
- Dir: `api/src/queues/` ✅ (plan explicitly states "NOT `api/src/services/queues/`", L2457).
- `api/src/queues/index.ts` exports: `getQueueConnection(): { connection: ConnectionOptions }` ✅, `getAllQueues(): { name, queue }[]` ✅, plus `export *` of the three queue modules (queue ctors + `*_QUEUE` name consts + job interfaces).
- Queue name constants: `PRODUCT_LOOKUP_QUEUE='product-lookup'`, `NOTIFICATION_SCHEDULE_QUEUE='notification-schedule'`, `NOTIFICATION_SEND_QUEUE='notification-send'` ✅ (matches spec §4.3 names).
- NOTE: M2's expected `api/src/queues/workers.ts` does **NOT exist** in M1. M1 puts workers under `api/src/workers/` (`runner.ts`, `notification-schedule.ts`, `notification-send.ts`, `product-lookup.ts`) with boot via `startWorkers()`/`stopWorkers()` from `api/src/workers/runner.ts`. **DRIFT: if M2 expects `api/src/queues/workers.ts`, that path is wrong — actual is `api/src/workers/runner.ts`.** Flag to M2.

### Circuit breakers (M3 cites `getBreaker(name)`)
- Registry file: `api/src/services/external/breakers.ts`. Exports `register(name, breaker)`, `getBreaker(name): CircuitBreaker` (throws `Breaker not registered: ${name}` if missing), `getAllBreakers(): {name, breaker}[]`.
- Factory: `api/src/lib/breaker.ts` → `makeBreaker(fn, opts)`.
- Registered names: `'off'`, `'upcitemdb'`, `'expo-push'` (each client calls `register(...)` at module load). ✅ `getBreaker('off'|'upcitemdb'|'expo-push')` available to M3.
- CONTRADICTION: registry test (L1001-1002) expects `getAllBreakers().map(x => x.name)` but `getAllBreakers` returns `{name, breaker}` AND a `freshBreaker` built with `new CircuitBreaker(... {name})`. `.name` on the returned wrapper works; fine. But test L996-1003 relies on map entries — OK. Minor.

### WatermelonDB (mobile) — schema + offline write queue
- `apps/mobile/src/db/schema.ts` v1: tables `records` + `products_cache`. Records carries `server_id`, `client_id`, `pending_sync`, `pending_delete` (offline write queue flags).
- Models `RecordModel` (table `records`), `ProductCacheModel` (table `products_cache`); DB singleton `apps/mobile/src/db/index.ts` exports `database`, `RecordModel`, `ProductCacheModel`.
- Sync engine `apps/mobile/src/db/sync.ts` → `runSync()` (push pending creates/updates/deletes, then pull `/records/sync` delta). Triggers `apps/mobile/src/db/triggers.ts` → `startSyncTriggers()`, `triggerSyncSoon()`.

---

## 3. Spec coverage & GAPS

| Spec requirement | Covered? | Notes |
|---|---|---|
| §2.3 lookup local→OFF→UPCitemdb→null | YES | `lookup.ts` C6. |
| §2.3 combined barcode+QR one flow | YES | `ScanCamera` BARCODE_TYPES includes ean13/ean8/upc_a/upc_e/qr. |
| §2.11 idempotency via client_id Idempotency-Key | YES | plugin + required on POST /records; mobile sends `Idempotency-Key: clientId`. |
| §2.5 schedule 7/1/0 default | YES | `DEFAULT_OFFSETS_DAYS=[7,1,0]`. |
| §2.5 per-record override | YES | `notificationOffsetsDays` in create/patch → recompute notify_at. |
| §2.5 per-user override | **PARTIAL/GAP** | `users.notificationPreferences` column added but **never read**. create/patch default to `DEFAULT_OFFSETS_DAYS`, ignoring the user's stored `offsetsDays`. Spec §2.5 "User can adjust globally". Per-user default is effectively dead. |
| §2.11 sync triggers (fg, reconnect, post-write, 5min) | YES | `triggers.ts`. |
| §2.11 conflict policy LWW user / server-wins shared | PARTIAL | LWW on records implemented (`updatedAt` compare). "Server wins on shared data (product details)" — products_cache pull not implemented in M1 sync (records-only sync). Acceptable for M1 (reviews/votes are M2). |
| §2.4 on-device OCR, no upload | YES | ML Kit on-device; no image sent to backend. |
| §2.11 `?since=` delta pull | PARTIAL | Plan uses `POST /records/sync` with `since` in body, NOT querystring `?since=`. Spec §2.11 says "Sync uses `?since=<timestamp>`". Functionally equivalent; contract differs from spec wording. |
| §6.3 `POST /records/sync` | YES | implemented. |
| §6.6 push token routes | YES | POST + DELETE. |

### Additional gaps / spec deviations
- **`templateKey` contradiction (internal):** `NotificationSendJob` interface (queues/notification-send.ts L2404-2409) has fields `recordId, userId, fireAt, offsetDays` — **no `templateKey`**. But the send worker reads `data.templateKey` (L4319,4336) and its TESTS pass `templateKey: 'expiry.warning_1d'` (L4222). And the schedule worker that ENQUEUES send jobs (L4136-4143) does **NOT** set `templateKey`. ⇒ Type error (interface lacks field) AND a runtime gap (production send jobs get `templateKey=undefined`, but `push_logs.templateKey` is NOT NULL → insert fails). **Must add `templateKey` to `NotificationSendJob` and have the schedule worker compute+pass it.**
- **`product-lookup` queue never enqueued:** spec §4.3 + plan architecture say background `product-lookup` job backfills slow lookups. Worker exists (I4) and queue is defined, but **no route/service ever calls `productLookupQueue().add(...)`**. The synchronous `lookup.ts` returns null on miss; nothing schedules the backfill. Dead queue in M1.
- **`expo-barcode-scanner` deprecation:** plan pins Expo SDK "latest stable" but uses `expo-barcode-scanner` + `Camera.onBarCodeScanned` API (removed in Expo SDK 50+/51; replaced by `expo-camera`'s `CameraView`/`onBarcodeScanned`). High chance the scan component + its test don't compile against current Expo. Spec §7.1 literally lists `expo-barcode-scanner`, so plan follows spec, but the API is stale.
- **`product/new` route not in File map:** O5 creates `apps/mobile/app/(app)/product/new.tsx` and scan screen routes to `/product/new`, but the File map (L120-162) lists only `product/[id].tsx`. `[id]` would greedily match `new` as an id → lookup `/products/new` 400/404. **Routing collision risk** unless an explicit `new.tsx` segment wins (Expo Router static > dynamic — actually static wins, so OK, but File map omission is a doc gap).
- **`country-suggestion` test uses different harness:** D28 test (L3857) imports `buildTestApp, signInAs` from `../helpers/app.js` and `ctx.start()/stop()`, whereas every other integration test uses `buildServer()` + `issueAccessToken`. Two different test harness conventions; `helpers/app.js` not in CONSUMES. Likely fails.

---

## 4. Top risks / contradictions (brutal)

1. **`templateKey` is broken end-to-end.** Send-job interface omits it, schedule worker never sets it, yet send worker + `push_logs.templateKey` (NOT NULL) require it. Notifications will throw on every real send. **Highest-priority fix.**

2. **Per-user notification preferences are dead.** Architecture decision adds `users.notificationPreferences Json?` and self-review §2.5 claims it's honored, but no code path reads it. Either wire it into create/patch/sync offset resolution or drop the column. (Guard: this is a user-confirmed architecture decision — do not silently drop; flag.)

3. **`/v1/me` mount strategy is self-contradictory.** H2 registers `pushTokenRoutes` standalone at `prefix:'/v1/me'`; H3 assumes a pre-existing `meScope` sub-app and does `meScope.register(...)`. If both run, routes double-register or `meScope` is undefined. Needs one canonical /v1/me composition (preferably a `routes/me/index.ts` registered once).

4. **Expo scanning API is stale / likely won't build.** `expo-barcode-scanner` + `onBarCodeScanned`/`barCodeScannerSettings` are removed in modern Expo SDK. ScanCamera.tsx, OcrCamera (`Camera ref takePictureAsync`), and `Camera.requestCameraPermissionsAsync` all use the legacy `expo-camera` API. Plan inherits this from spec §7.1 but it will break against "latest stable". Decision point: pin older SDK or migrate to `CameraView`/`useCameraPermissions`.

5. **Worker path drift vs M2 expectation + product-lookup queue unused.** M2 reportedly expects `api/src/queues/workers.ts`; M1 actually boots workers from `api/src/workers/runner.ts` (`startWorkers`/`stopWorkers`). Plus `product-lookup` queue is defined + has a worker but is never enqueued anywhere. M2 must not assume `queues/workers.ts`.

### Lesser flags (note, don't block)
- DELETE /records cancels send jobs by scanning `getJobs(['delayed','waiting'])` and filtering `j.data?.recordId` — O(n) over all users' jobs; fine at v1 scale, weak at scale.
- `idempotency.ts` `onSend` doesn't scope key by user — two users with same client UUID (collision near-impossible w/ UUIDv4) could replay each other's cached response. Records route additionally guards by `clientId @unique` + ownership check, so practical risk ~0.
- `computeNotifyAt` fixes 09:00 **UTC**, not user-local (test comment says "user-local UTC" but code is pure UTC). Spec doesn't pin tz; acceptable but not localized.
- Idempotency TTL fixed 24h matches spec §6.8. OK.
- `recordSyncBatchSchema` uses `recordCreateSchema.unwrap()` — only valid because `.refine` wraps a single object (ZodEffects.unwrap exists). Correct, but brittle if schema later gets a second `.refine`.
- Circuit-breaker-open → fallback returns `null` → lookup returns null → route 404 "not found". Matches spec §4.3 "graceful not found". ✅ Verified consistent.

---

## Unresolved questions
- Does M0a export `logger` from `api/src/logger.ts`, and `issueAccessToken` from `api/src/services/auth/tokens.ts`? (heavily consumed, not in prereq list)
- Does M0c's theme token object include every token M1 touches (`bgElevated, primaryFg, textInverse, success, warning, radii.pill`)?
- Does M2 actually require `api/src/queues/workers.ts` and `getQueueConnection` from `queues/index.ts`? (the latter is provided; the former is NOT)
- Is the per-user `notificationPreferences` meant to be honored in M1 or deferred? (column exists, unused)
