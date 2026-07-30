# Mobile Scan Product Creation Design

## Summary

When an authenticated mobile user scans a barcode or QR code and the catalog lookup conclusively finds no product, Expyrico will offer a resumable product-creation workflow. The user supplies a required product name, an optional plain-text description, existing optional catalog metadata, and up to five optional product photos from the camera or gallery. After submission, the creator can immediately continue into the existing pantry-record form while the product remains private and awaits admin review.

The feature uses a private product draft, a moderated catalog lifecycle, ordered multi-photo storage on the self-hosted VPS, and explicit lookup outcomes that distinguish a confirmed miss from an upstream outage. It expands the existing `ProductNew` flow rather than replacing the scanner or pantry-record workflow.

## User decisions

- Scope: expanded beyond initial creation to include photo editing/reordering/removal, server-side image processing, moderation, revisions, and resubmission.
- Publication: creator-usable immediately; hidden from other users until admin approval.
- Storage: VPS filesystem, served through nginx.
- Photo limit: five per product.
- Description: optional, plain text, maximum 2,000 characters.
- Photo sources: camera and gallery, with crop/rotate support.
- Creation eligibility: only after a conclusive lookup miss; outages show Retry.
- Editing: creator edits private products directly; changes to active products require moderation. Admins may edit directly.
- Code types: the rich creation flow applies to both barcodes and QR codes.
- Rejection: retain the private product with feedback, then allow revision and resubmission.
- Completion: after product submission, continue immediately to the pantry-record form.
- Architecture: private draft with independent, retryable photo operations.

## Goals

1. Let an authenticated user create a missing product without losing the scanned barcode or QR payload.
2. Preserve catalog integrity by distinguishing a confirmed lookup miss from a temporary external-API failure.
3. Support zero to five ordered, processed product photos without storing arbitrary client URLs.
4. Let the creator use a submitted product in their own pantry immediately while keeping unreviewed catalog data private.
5. Give admins a complete moderation path: approve, request changes, correct, reorder/remove photos, or merge duplicates.
6. Make retries, concurrent scans, interrupted uploads, and filesystem/database failures safe.
7. Reuse existing product, `ProductEdit`, scanner, React Query, Fastify, Prisma, admin, and pantry-record patterns where practical.

## Non-goals

- Offline product submission or offline photo upload.
- Public visibility of unapproved product metadata or media.
- Video, animated GIF, SVG, or document uploads.
- Retaining original uploaded files or EXIF metadata.
- Arbitrary user-provided image URLs.
- Changing the existing Open Food Facts or UPCitemdb provider order.
- Automatically publishing AI-generated metadata or images.
- Building a general-purpose media service outside the product domain.

## Existing behavior and constraints

- `apps/mobile/app/(app)/scan.tsx` currently calls `POST /products/lookup`, opens product detail on a hit, and routes every lookup error to `ProductNew`.
- `apps/mobile/app/(app)/product/new.tsx` already accepts the scanned barcode or QR value, creates a product with name and optional brand, then renders `AddRecordForm`.
- `POST /v1/products` already requires authentication, creates a `source: user` product, records `createdByUserId`, and returns `409` for duplicate barcode/QR values.
- `Product` currently has one `imageUrl`, no description, and `active | pending | merged_into` status values.
- `ProductEdit` already represents moderated changes but does not yet cover a complete mobile edit flow or staged photo sets.
- The codebase has URL fields for record, deal, and giveaway photos, but no implemented upload/storage pipeline.
- Product barcode and QR columns are globally unique in PostgreSQL.
- Mobile consumes a committed vendored build of `@expyrico/shared`; contract changes must rebuild and refresh both the vendored distribution and the pnpm-resolved copy used by Jest.
- The API has a 1 MB default body limit. Product photo upload routes therefore require explicit multipart streaming limits rather than increasing the global JSON limit.

## Recommended architecture

### Why a private draft

A one-shot multipart product creation request is simple only on the happy path. It is fragile when one of five uploads fails, when a user leaves and returns, or when photos must later be reordered, removed, rejected, and resubmitted. Upload-first temporary tokens provide better retry behavior but introduce a separate temporary-asset lifecycle that still does not model moderation.

The selected design creates or resumes a private product draft for the scanned identifier. Product fields and photos are changed through focused, authenticated operations. Submission is an explicit state transition. This gives uploads independent progress and retries, provides a durable moderation object, and lets abandoned work be cleaned safely.

## Domain model

### Product lifecycle

Extend `ProductStatus` to:

- `draft`: creator-only, editable, not submitted.
- `pending`: creator/admin-visible, submitted for review.
- `changes_required`: creator/admin-visible, editable with an admin reason.
- `active`: public catalog product.
- `merged_into`: duplicate redirected to a canonical product.

Allowed transitions:

```text
create/resume -> draft
draft -> pending
pending -> active
pending -> changes_required
changes_required -> pending
draft | pending | changes_required -> merged_into
active -> merged_into
```

Only the creator and admins may read `draft`, `pending`, or `changes_required` products. The creator may attach their own private submitted product to a pantry record. Other users cannot search for, read, or attach a private product.

If another user scans an identifier already reserved by somebody else's private product, the API must not reveal private metadata. The mobile app shows that the product is under review and allows the user to add an unlinked custom pantry item instead of creating a duplicate. When the canonical product becomes active, normal exact lookup returns it.

### Product fields

Add:

- `description String?` mapped to `description`.
- `moderationNotes String?` or a dedicated moderation-event relation for current creator-facing feedback.
- `submittedAt DateTime?`.
- `moderatedAt DateTime?`.
- `moderatedByUserId String?` for the admin who last approved or requested changes.
- `version Int @default(1)` incremented by every metadata, lifecycle, or photo-order mutation for optimistic concurrency control.

Requirements:

- `name`: trimmed, required, 1–200 characters.
- `description`: trimmed plain text, optional, maximum 2,000 characters; blank becomes `null`.
- `brand` and `category`: remain optional and retain existing limits.
- `barcode`/`qrPayload`: immutable after draft creation.
- one and only one identifier is required for scan-created drafts.
- `source`: `user`.
- `createdByUserId`: authenticated creator.

### Product photos

Add a `ProductPhoto` relation rather than storing an array in `Product`:

- `id` UUID.
- `productId` UUID.
- opaque server-generated storage key/path.
- `displayUrl` and `thumbnailUrl`, or deterministic URL derivation from the key.
- normalized MIME type (`image/webp`).
- display byte size, width, and height.
- thumbnail byte size, width, and height.
- `position` from 0 to 4; position 0 is the cover.
- moderation status (`pending | approved | rejected`) and optional moderation note.
- creator/uploader ID and timestamps.

Enforce at the service/database level:

- maximum five non-deleted photos per product.
- unique `(productId, position)`.
- contiguous ordering after add, reorder, or delete.
- only server-generated storage identifiers.

During compatibility migration, `Product.imageUrl` mirrors the active cover display URL. New contracts expose `photos[]` and derive a cover from position 0. After all clients use the relation and data is migrated, a later cleanup may remove `imageUrl`; that removal is not required for initial release.

### Active-product revisions

Creator changes to `active` products must not mutate the live catalog before approval.

- Continue using `ProductEdit` for proposed text/metadata.
- Add staged edit-photo records (for example, `ProductEditPhoto`) or an equivalent staged media relation associated with the edit.
- The proposal stores the desired ordered photo set, including retained active photos and newly staged media.
- Newly staged media is private and not served from public CDN routes.
- Admin approval atomically applies the proposed metadata and photo relations in PostgreSQL. File cleanup for replaced photos occurs after commit through retryable cleanup.
- Rejection preserves feedback and keeps live product fields/photos unchanged.

## Lookup contract and data flow

### Explicit outcomes

The current lookup service turns upstream exceptions into `null`, making an outage indistinguishable from a real miss. Manual creation is safe only after all applicable sources have conclusively returned no match.

Model each lookup source as:

```ts
type SourceLookupResult<T> =
  | { outcome: 'found'; value: T }
  | { outcome: 'not_found' }
  | { outcome: 'unavailable'; retryAfterSeconds?: number };
```

Endpoint behavior:

- `found`: return the product.
- `not_found`: return an explicit shared error/outcome code that the mobile app alone treats as creation-eligible.
- `temporarily_unavailable`: return a retryable 503-style problem response or discriminated response; never route it to creation.

Barcode lookup:

1. Search local products by barcode, subject to visibility rules.
2. Query Open Food Facts.
3. If not found, query UPCitemdb.
4. Return confirmed `not_found` only if every applicable provider completed and returned no match.
5. If any provider required to prove absence failed and no provider found a product, return `temporarily_unavailable`.

QR lookup:

1. Search local products by exact `qrPayload`, subject to visibility rules.
2. A local miss is conclusive because external barcode providers do not support arbitrary QR payloads.

Do not enqueue the existing product-lookup backfill after a conclusive miss. It can race with a new user draft and later overwrite user-owned fields through the current upsert path. If background retry remains for unavailable lookups, it must never update `source: user` or private products and must respect product lifecycle and ownership.

### Scan flow

1. Scan a barcode or QR code once.
2. Pause/deactivate scanning while lookup is pending to prevent duplicate requests.
3. `found` -> replace with product detail.
4. `not_found` -> show a dedicated state with **Create product** and **Scan again**.
5. `temporarily_unavailable` or network/server failure -> show **Retry** and **Scan again**; do not offer creation.
6. Create/resume the authenticated user's permitted draft using the immutable scanned identifier.
7. Open the product editor.

The app must not use a blanket `catch` to infer not-found.

## Mobile product editor

### Fields

- Product name: required.
- Description: optional multiline plain text, 2,000-character counter.
- Brand: optional, preserved from the existing form.
- Category: optional, available because the catalog already supports it.
- Read-only scanned barcode or QR value.
- Ordered photo gallery with zero to five photos.

Use Expyrico theme tokens and existing accessible form/button components. Provide explicit labels, errors adjacent to fields, 48 px touch targets, screen-reader descriptions for upload status and photo order, and non-color status text.

### Photo input

Use a maintained bare-React-Native image picker/cropper compatible with React Native 0.76 and the enabled New Architecture. The initial candidate is `react-native-image-crop-picker`, verified against current native build requirements during implementation.

Support:

- take a photo with the rear camera.
- select one or multiple gallery images up to remaining capacity.
- crop and rotate each image.
- show local previews before/during upload.
- client-side compression/resizing to reduce transfer time.
- upload each photo independently with progress, cancel, and retry.
- clean picker temporary files after confirmed upload or explicit discard.
- remove, reorder, and mark a cover photo.

Client validation is advisory. The server revalidates all content.

### Draft behavior

- Draft creation/resume is idempotent by authenticated creator and identifier.
- Save field changes explicitly or with debounced autosave after a server draft exists.
- Uploaded photos persist independently.
- Leaving with unsaved local field/photo edits prompts the user.
- A server-saved draft can be resumed from a later scan or a creator drafts area.
- Submission is a visible **Submit product** action, not an implicit autosave.

### Submit and continue

Submission validates:

- current lifecycle permits submission.
- caller owns the draft.
- identifier is still canonical and unique.
- name and optional metadata are valid.
- all photo operations have completed.
- photo count and order are valid.
- required abuse-verification token and quotas pass.

A successful submission transitions `draft | changes_required -> pending`, records `submittedAt`, and immediately renders the existing `AddRecordForm` with the product ID and name. Pantry-record creation is not blocked by moderation. Show a non-blocking message that the product is awaiting review.

## API surface

Keep routes in the existing `/v1/products` grouping:

- `POST /products/lookup` — explicit found/not-found/unavailable semantics.
- `POST /products/drafts` — create or resume a private draft for barcode/QR.
- `GET /products/:id` — return active products or caller-authorized private products.
- `PATCH /products/:id/draft` — update creator draft metadata with required `version`.
- `POST /products/:id/photos` — upload one draft photo per multipart request.
- `DELETE /products/:id/photos/:photoId` — delete a draft photo with required `version`.
- `PUT /products/:id/photos/order` — submit the complete ordered photo ID list with required `version`; index 0 is cover.
- `POST /products/:id/submit` — submit a draft or changes-required product idempotently.
- `PUT /products/:id/edit` — create/update the caller's staged edit proposal for an active product.
- `POST|DELETE|PUT /products/:id/edit/photos...` — upload, delete, and reorder staged edit photos.
- `POST /products/:id/edit/submit` — submit an active-product revision idempotently.

The existing admin `/v1/admin/products` domain gains pending-submission and revision list/detail/resolve routes, following its current route conventions.

All mutations require authentication, server-side Zod validation for structured fields, authorization in a product-domain service, and route-specific rate limits. Use idempotency keys for draft creation and submission. Route handlers remain thin; product lifecycle, visibility, media, and concurrency logic belong in services rather than direct Prisma calls.

## Photo upload and processing

### Limits

- one file per request.
- five photos per product.
- maximum 10 MB compressed upload per file.
- JPEG, PNG, and HEIC only when the deployed decoder supports the input.
- no SVG, GIF, video, archive, or arbitrary binary input.
- maximum 40 megapixels decoded input with bounded dimensions and channels.
- fail fast on malformed or truncated images.

### Streaming pipeline

1. Register a Fastify multipart plugin version compatible with Fastify 4.
2. Apply route-specific part count and file-size limits with file-limit exceptions enabled.
3. Stream the single part into a random quarantine filename on the same filesystem as final media; never call `toBuffer()` for the whole upload.
4. Reject extra files/parts, stream truncation, or limit overflow.
5. Treat the declared MIME type and filename as untrusted hints.
6. Decode with Sharp using strict failure behavior and `limitInputPixels`.
7. Inspect metadata, reject unsupported formats/dimensions/channels, apply EXIF orientation, convert to sRGB, and strip metadata.
8. Generate:
   - display WebP: fit inside 1600x1600, no enlargement.
   - thumbnail WebP: fit inside 480x480, no enlargement.
9. Write generated files into a temporary sibling directory and fsync/close as required by the chosen durability policy.
10. Atomically rename finalized variants into an opaque UUID directory.
11. In a database transaction, verify authorization/state/photo quota/version and insert the `ProductPhoto` row at the requested position.
12. If the database transaction fails, delete finalized variants. If generation fails, remove all temp files.
13. Return only server-generated metadata and URLs.

### Filesystem layout

Media must live outside the release checkout and static source tree:

```text
/var/lib/expyrico/media/
  quarantine/
  products/<product-id>/<photo-id>/display.webp
  products/<product-id>/<photo-id>/thumb.webp
  product-edits/<edit-id>/<photo-id>/display.webp
  product-edits/<edit-id>/<photo-id>/thumb.webp
```

All segments are generated UUIDs. Resolve paths against the configured media root and verify containment before every filesystem operation. Never concatenate user-provided path fragments.

### Delivery

- Nginx serves only finalized, approved variants from `https://cdn.expyrico.app/products/...`.
- Private draft, pending, changes-required, and staged edit media is returned through an authenticated/authorized API media route or another guarded internal location. It must not be publicly reachable merely because its UUID is known.
- Disable directory listing and content sniffing.
- Serve UUID-addressed active media with immutable cache headers.
- Do not expose quarantine, temp files, source uploads, or server paths.
- Media directories are non-executable and owned by a dedicated least-privilege API/media user.

### Deletion and orphan cleanup

Filesystem and PostgreSQL cannot participate in one transaction.

- Delete or detach the database relation first.
- Queue or record a cleanup operation after commit.
- Retry failed file deletion through a sweeper; never restore a deleted relation because file deletion failed.
- Sweep quarantine/temp files beyond a short safety age.
- Sweep unreferenced staged media after its retention period.
- Delete abandoned `draft` products and their unreferenced files after 30 days.
- Never sweep `pending`, `changes_required`, `active`, or any product referenced by pantry records.

## Moderation and admin UX

Extend the existing admin Products domain rather than creating a separate moderation application.

### Submission queue

Show:

- pending products and active-product edit proposals.
- barcode/QR, source, creator, submitted timestamp, current status.
- name, description, brand, category.
- ordered display photos with cover indication.
- prior rejection/change-request history.
- duplicate candidates when exact identifiers or admin search indicate overlap.

### Actions

- Approve product -> `pending -> active`; approve eligible photos and expose public media.
- Request changes -> `pending -> changes_required`; require a creator-visible reason.
- Correct fields directly as an admin.
- Remove/reorder photos and set cover.
- Merge into a canonical product and redirect records/edits according to existing merge behavior.
- Approve/reject active-product revisions; approval applies the entire validated proposal, rejection preserves the current public version.

Every action records an `AdminAuditLog` entry with actor, target, action, request ID, and structured diff/notes. Do not include raw image bytes or sensitive filesystem paths in logs.

## Visibility and authorization

Centralize product visibility predicates in the product service/repository and apply them consistently to:

- exact barcode/QR lookup.
- product detail.
- product search.
- pantry-record product attachment.
- mobile draft retrieval.
- media retrieval.
- admin views.

Rules:

- authenticated users may read `active` products.
- creator may read/use their own private product.
- admins may read/manage all states.
- other users receive a non-enumerating response for private products; exact scan may report “under review” without exposing creator or product metadata.
- only creator/admin may mutate a private product.
- only admins may directly mutate an active product; creator changes go through `ProductEdit`.
- merged products resolve to their canonical active product where permitted.

## Concurrency and idempotency

- PostgreSQL unique constraints remain the final authority for barcode/QR uniqueness.
- Draft creation uses an idempotency key plus conflict-safe create/resume logic.
- Identifiers are immutable after draft creation.
- Metadata updates and photo reorder/delete require the current product/edit `version`; each successful transaction increments it and stale versions return a typed 409 conflict.
- Enforce photo quota and position changes within a transaction; avoid read-then-write quota races.
- Submit uses a conditional state transition so repeated submit calls return the same result.
- If an external/admin canonical product wins while a user is editing, return a typed conflict referencing only a product the caller may access and navigate to that product.
- External lookup persistence must never overwrite a `source: user` product or private draft.
- Merge behavior must handle creator pantry records, pending edits, and staged media explicitly.

## Abuse prevention and input security

- Require authentication on all draft, media, revision, and moderation routes.
- Apply existing per-user/IP rate limiting plus stricter quotas for draft creation, bytes uploaded, photos uploaded, and failed uploads.
- Require server-verified reCAPTCHA/abuse-verification for product submission according to the project security mandate; implementation must select a mobile-compatible, current Google integration and never trust a client-only success flag.
- Validate all structured input with shared Zod schemas at the API boundary and again enforce domain invariants in services.
- Store description as plain text only; reject or normalize control characters. Rendering clients must not interpret it as HTML.
- Verify decoded image bytes with Sharp; filename, extension, MIME, dimensions, and EXIF from the client are untrusted.
- Strip all metadata, including geolocation.
- Enforce stream, part-count, decoded-pixel, dimension, channel, output-size, and time/resource limits.
- Keep upload quarantine and finalized private media outside public nginx aliases.
- Check available disk space before accepting uploads and fail safely when below a configured reserve.
- Monitor disk use, processing failures, sweeper failures, and unusual per-user upload volume.
- Never log image bodies, credentials, local user paths, EXIF, or absolute storage paths.

## Configuration, deployment, and operations

Add validated, fail-fast API configuration for:

- absolute media root.
- public media base URL.
- upload byte limit.
- decoded pixel limit.
- display/thumbnail bounds and WebP encoding quality, validated even when defaults are used.
- draft/temp retention periods.
- disk reserve threshold.
- optional processing concurrency.

Keep secrets in environment variables and do not commit `.env` files. The media root and public base URL are configuration, not secrets.

Deployment must:

- install native Sharp dependencies through the package lock/build process.
- create media/quarantine directories with least privilege.
- configure the CDN nginx vhost/alias and security/cache headers.
- ensure release replacement never deletes `/var/lib/expyrico/media`.
- include PostgreSQL and finalized media in coordinated backups.
- exclude quarantine/temp files from backup.
- document and test restoration so DB photo rows and media files are restored consistently.
- add disk-capacity monitoring and alerting before the reserve threshold is reached.

## Error behavior

- Confirmed lookup miss: creation CTA.
- Lookup unavailable: retryable message, no creation CTA.
- Duplicate identifier visible to caller: navigate to canonical product.
- Identifier held by another private submission: non-enumerating “under review” state plus custom unlinked pantry-item fallback.
- Invalid form: field-level errors; preserve draft and uploaded photos.
- Picker cancellation: no error banner.
- Upload validation failure: mark only that local photo failed; allow remove or retry.
- Network/upload interruption: retain server-confirmed photos and retry incomplete photo.
- Five-photo limit: disable add actions and announce the limit.
- Stale version/reorder conflict: refresh draft, preserve local intent where safe, and ask user to retry.
- Submission with pending uploads: block submit with a clear explanation.
- Admin request changes: show reason and return editor to editable state.
- Disk reserve reached: return a retryable storage-capacity error and alert operations; do not create partial DB rows.

## Testing strategy

### Shared contracts

- Product lifecycle status values.
- optional description normalization and maximum length.
- ordered photo response and upload/reorder/delete request schemas.
- lookup found/not-found/unavailable outcomes and error codes.
- draft, submit, moderation, and revision schemas.
- refresh mobile vendored shared distributions and assert Jest resolves the new contract.

### API unit/integration

- barcode: local hit, OFF hit, UPCitemdb hit, conclusive full miss, each upstream failure combination, and no false not-found on outage.
- QR: local hit and conclusive local miss.
- create/resume idempotency and identifier immutability.
- duplicate barcode/QR races across users.
- visibility for active, creator-private, other-user-private, and admin.
- private product pantry attachment allowed only for creator.
- lifecycle transition guards, repeated submit, request changes, resubmit, approve, and merge.
- active-product edit staging, approval, and rejection without premature public mutation.
- multipart extra-part, multiple-file, oversized, truncated, wrong MIME, spoofed MIME, malformed decode, unsupported format, excess pixels/channels, and traversal attempts.
- successful orientation, metadata stripping, WebP variants, dimensions, and cover projection.
- photo quota race, reorder/delete race, optimistic-version conflicts, and contiguous positions.
- cleanup after processing failure, DB failure, delete failure, abandoned draft, and orphan staged media.
- private media authorization and absence from public nginx paths.
- rate/byte quotas, disk-reserve behavior, and audit logs.

Use real PostgreSQL/Redis integration patterns. Filesystem tests use isolated temporary directories and verify exact remaining files without touching configured production paths.

### Mobile

- scanner pauses/debounces during lookup.
- found, confirmed miss, unavailable, retry, and scan-again paths.
- no blanket error-to-create navigation.
- barcode and QR identifiers passed immutably to draft creation.
- draft resume and rejection feedback.
- name required; description optional/max length.
- camera/gallery permission, cancellation, multi-select remaining limit, crop result, and temp cleanup.
- local preview, per-photo progress, retry, remove, reorder, cover, and five-photo cap.
- unsaved local change prompt and persisted draft recovery.
- submit disabled for invalid fields or pending uploads.
- successful submit opens `AddRecordForm` and moderation does not block pantry save.
- another user's private identifier exposes no metadata and offers custom pantry fallback.
- accessibility labels, focus movement, dynamic type, touch targets, and theme variants.

### Admin

- submission/revision queue filters and pagination.
- product/photo detail rendering.
- approval and public visibility.
- request changes requires a reason and surfaces it to creator.
- direct correction, reorder/remove, duplicate merge, revision approve/reject.
- audit log creation and error handling.

### Infrastructure and device verification

- nginx serves approved variants with expected cache/security headers.
- no directory listing, quarantine exposure, private-media exposure, path traversal, or executable content.
- backup includes finalized media; restore aligns database rows and files.
- disk reserve and monitoring alerts work.
- Android debug build installs on the physical device.
- on-device smoke test: scan miss, retry on simulated outage, camera capture, gallery multi-select, crop/rotate, upload retry, reorder/remove/cover, submit, add pantry record, rejection/resubmission, and approved public lookup.

## Rollout and migration

1. Add schema/models/statuses while preserving existing `active` products.
2. Backfill any existing non-null `imageUrl` into a position-0 photo representation only when ownership/storage semantics are understood; external URLs may remain compatibility-only rather than copied onto VPS.
3. Add API services and shared contracts behind tests.
4. Provision media directories, backup, monitoring, and private/public nginx behavior before enabling upload routes.
5. Add admin moderation support before mobile submission is enabled so pending products cannot accumulate without review tooling.
6. Add mobile draft/editor flow and vendored shared contracts.
7. Add a `productCreationEnabled` API feature flag and enable it for internal users first; disabled clients retain scan lookup and custom unlinked pantry entry.
8. Monitor lookup-unavailable rate, draft abandonment, upload rejection, disk growth, moderation latency, and duplicate merges.
9. Retire compatibility `imageUrl` only in a separately reviewed cleanup after every client consumes `photos[]`.

## Success criteria

- A barcode or QR conclusive miss offers creation; provider/network outages never do.
- User can create/resume a private draft with required name, optional description, and zero to five camera/gallery photos.
- Images are decoded, normalized, metadata-stripped, stored outside releases, and served only through authorized/public-approved paths.
- User can retry, remove, reorder, and select a cover without restarting the form.
- Submission becomes creator-usable immediately and remains hidden from other users until approval.
- Admin can approve, request changes with a reason, correct, reorder/remove, merge, and review active-product revisions.
- Rejected submissions are editable and resubmittable.
- Identifier, photo quota, order, state transitions, and external-persistence races are database-safe.
- Abandoned drafts/temp/orphan files are cleaned without deleting referenced or moderated products.
- Backups and restore cover database plus finalized media.
- Focused and broad typecheck/tests/build/device gates pass without weakening existing tests.

## Open questions

None. The user approved all scope, lifecycle, storage, limit, editing, lookup, rejection, flow, moderation, security, cleanup, and verification decisions in this design session.
