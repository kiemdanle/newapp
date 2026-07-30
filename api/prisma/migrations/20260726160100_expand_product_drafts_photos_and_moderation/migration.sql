-- Adds the creator-private draft/photo/moderation data model on top of the enum
-- values added by the previous migration. Every existing products/product_edits
-- row is left semantically unchanged: `product_creation` ships `{"mode":"off"}`,
-- so nothing can create a new-lifecycle row yet, and legacy product_edits rows are
-- flagged `is_legacy = true` so the new one-open-edit constraint never applies to
-- historical data.

-- New enums (brand new types, so no same-transaction restriction applies).
CREATE TYPE "product_photo_moderation_status" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "media_operation_type" AS ENUM ('promote_private', 'publish_public', 'delete_private', 'delete_public', 'delete_staged', 'enqueue_cleanup');
CREATE TYPE "media_operation_status" AS ENUM ('prepared', 'pending', 'processing', 'completed', 'failed');

-- Product gains description, optimistic version, moderation feedback/actor/time.
ALTER TABLE "products"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "moderation_notes" TEXT,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "moderated_at" TIMESTAMP(3),
  ADD COLUMN "moderated_by_user_id" UUID;

ALTER TABLE "products"
  ADD CONSTRAINT "products_moderated_by_user_id_fkey"
  FOREIGN KEY ("moderated_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE SET NULL;

-- ProductEdit gains versioning + moderation timestamps. `updated_at` and the count
-- columns need a DEFAULT to backfill existing rows as NOT NULL in one statement.
ALTER TABLE "product_edits"
  ADD COLUMN "is_legacy" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "base_product_version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "moderation_notes" TEXT,
  ADD COLUMN "submitted_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- One open lifecycle edit (draft|pending|changes_required) per creator/product.
-- Legacy rows are excluded so pre-existing pending/approved/rejected history can
-- never trip this constraint.
CREATE UNIQUE INDEX "product_edits_one_open_lifecycle_edit_per_creator_idx"
  ON "product_edits" ("product_id", "submitted_by")
  WHERE (NOT "is_legacy" AND "status" = ANY (ARRAY['draft', 'pending', 'changes_required']::"product_edit_status"[]));

-- Shared immutability guard: once a row referencing a product is created, its
-- product relation can never be repointed to a different product.
CREATE FUNCTION "assert_product_relation_is_immutable"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."product_id" IS DISTINCT FROM OLD."product_id" THEN
    RAISE EXCEPTION 'product relation is immutable once created'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Guards that a retained-photo edit entry always points at a photo belonging to
-- the same product as the edit itself, locking both parent rows first so a
-- concurrent product reassignment cannot race past the check.
CREATE FUNCTION "assert_product_edit_photo_source_product_matches_edit"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW."source_product_photo_id" IS NULL THEN
    RETURN NEW;
  END IF;

  -- Lock both parent rows before validating their relationship. This makes a
  -- concurrent product reassignment wait until the retained link commits.
  PERFORM 1
  FROM "product_edits"
  WHERE "id" = NEW."product_edit_id"
  FOR SHARE;

  PERFORM 1
  FROM "product_photos"
  WHERE "id" = NEW."source_product_photo_id"
  FOR SHARE;

  IF NOT EXISTS (
    SELECT 1
    FROM "product_edits" AS edit
    JOIN "product_photos" AS photo ON photo."id" = NEW."source_product_photo_id"
    WHERE edit."id" = NEW."product_edit_id"
      AND edit."product_id" = photo."product_id"
  ) THEN
    RAISE EXCEPTION 'retained product photo must belong to the edited product'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

-- Validates the MediaOperationOutbox payload shape: a non-empty array of
-- non-blank string storage keys under `keys`.
CREATE FUNCTION "is_valid_media_operation_payload"(candidate jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT jsonb_typeof("candidate") = 'object'
    AND jsonb_typeof("candidate" -> 'keys') = 'array'
    AND jsonb_array_length("candidate" -> 'keys') > 0
    AND COALESCE((
      SELECT bool_and(
        jsonb_typeof(entries.item) = 'string'
        AND btrim(entries.item #>> '{}') <> ''
      )
      FROM jsonb_array_elements("candidate" -> 'keys') AS entries(item)
    ), false);
$$;

-- Ordered, immutable-once-published photos on a live/draft product. Position 0
-- is cover. Exactly one of private_storage_key (pre-publication) or
-- public_storage_key (post-publication) is set, tied to moderation_status.
CREATE TABLE "product_photos" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "uploaded_by_user_id" UUID NOT NULL,
    "moderation_status" "product_photo_moderation_status" NOT NULL DEFAULT 'pending',
    "moderation_note" TEXT,
    "private_storage_key" TEXT,
    "public_storage_key" TEXT,
    "mime_type" TEXT NOT NULL,
    "display_byte_size" INTEGER NOT NULL,
    "display_width" INTEGER NOT NULL,
    "display_height" INTEGER NOT NULL,
    "thumbnail_byte_size" INTEGER NOT NULL,
    "thumbnail_width" INTEGER NOT NULL,
    "thumbnail_height" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_photos_position_check" CHECK ("position" >= 0 AND "position" <= 4),
    CONSTRAINT "product_photos_mime_type_check" CHECK ("mime_type" = 'image/webp'),
    CONSTRAINT "product_photos_display_metadata_check" CHECK ("display_byte_size" >= 0 AND "display_width" > 0 AND "display_height" > 0),
    CONSTRAINT "product_photos_thumbnail_metadata_check" CHECK ("thumbnail_byte_size" >= 0 AND "thumbnail_width" > 0 AND "thumbnail_height" > 0),
    CONSTRAINT "product_photos_storage_and_moderation_check" CHECK (
      ("moderation_status" = ANY (ARRAY['pending', 'rejected']::"product_photo_moderation_status"[])
        AND "private_storage_key" IS NOT NULL AND "public_storage_key" IS NULL)
      OR ("moderation_status" = 'approved'
        AND "private_storage_key" IS NULL AND "public_storage_key" IS NOT NULL)
    )
);

ALTER TABLE "product_photos"
  ADD CONSTRAINT "product_photos_product_id_position_key" UNIQUE ("product_id", "position"),
  ADD CONSTRAINT "product_photos_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT "product_photos_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TRIGGER "product_photos_product_relation_immutable_trigger"
  BEFORE UPDATE OF "product_id" ON "product_photos"
  FOR EACH ROW EXECUTE FUNCTION "assert_product_relation_is_immutable"();

-- Applies the same immutability guard to product_edits: an edit's product
-- relation can never be repointed after creation.
CREATE TRIGGER "product_edits_product_relation_immutable_trigger"
  BEFORE UPDATE OF "product_id" ON "product_edits"
  FOR EACH ROW EXECUTE FUNCTION "assert_product_relation_is_immutable"();

-- One entry per desired position in an edit's proposed photo set: either a
-- retained live photo (source_product_photo_id set, no staged fields) or newly
-- staged media (all staged fields set, no source) — never both, never neither.
CREATE TABLE "product_edit_photos" (
    "id" UUID NOT NULL,
    "product_edit_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "source_product_photo_id" UUID,
    "uploaded_by_user_id" UUID,
    "private_storage_key" TEXT,
    "mime_type" TEXT,
    "display_byte_size" INTEGER,
    "display_width" INTEGER,
    "display_height" INTEGER,
    "thumbnail_byte_size" INTEGER,
    "thumbnail_width" INTEGER,
    "thumbnail_height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_edit_photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_edit_photos_position_check" CHECK ("position" >= 0 AND "position" <= 4),
    CONSTRAINT "product_edit_photos_representation_check" CHECK (
      ("source_product_photo_id" IS NOT NULL
        AND "uploaded_by_user_id" IS NULL AND "private_storage_key" IS NULL AND "mime_type" IS NULL
        AND "display_byte_size" IS NULL AND "display_width" IS NULL AND "display_height" IS NULL
        AND "thumbnail_byte_size" IS NULL AND "thumbnail_width" IS NULL AND "thumbnail_height" IS NULL)
      OR ("source_product_photo_id" IS NULL
        AND "uploaded_by_user_id" IS NOT NULL AND "private_storage_key" IS NOT NULL
        AND "mime_type" IS NOT NULL AND "mime_type" = 'image/webp'
        AND "display_byte_size" IS NOT NULL AND "display_byte_size" >= 0
        AND "display_width" IS NOT NULL AND "display_width" > 0
        AND "display_height" IS NOT NULL AND "display_height" > 0
        AND "thumbnail_byte_size" IS NOT NULL AND "thumbnail_byte_size" >= 0
        AND "thumbnail_width" IS NOT NULL AND "thumbnail_width" > 0
        AND "thumbnail_height" IS NOT NULL AND "thumbnail_height" > 0)
    )
);

ALTER TABLE "product_edit_photos"
  ADD CONSTRAINT "product_edit_photos_product_edit_id_position_key" UNIQUE ("product_edit_id", "position"),
  ADD CONSTRAINT "product_edit_photos_product_edit_id_fkey" FOREIGN KEY ("product_edit_id") REFERENCES "product_edits"("id") ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT "product_edit_photos_source_product_photo_id_fkey" FOREIGN KEY ("source_product_photo_id") REFERENCES "product_photos"("id") ON UPDATE CASCADE ON DELETE RESTRICT,
  ADD CONSTRAINT "product_edit_photos_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON UPDATE CASCADE ON DELETE RESTRICT;

CREATE TRIGGER "product_edit_photos_source_product_matches_edit_trigger"
  BEFORE INSERT OR UPDATE OF "product_edit_id", "source_product_photo_id" ON "product_edit_photos"
  FOR EACH ROW EXECUTE FUNCTION "assert_product_edit_photo_source_product_matches_edit"();

-- Durable DB/filesystem handoff for private-promotion and public-publish media
-- operations. A `prepared` intent with a renewable lease is committed before any
-- final rename/copy; the reference-changing transaction completes it atomically.
CREATE TABLE "media_operation_outbox" (
    "id" UUID NOT NULL,
    "operation" "media_operation_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "media_operation_status" NOT NULL DEFAULT 'pending',
    "lease_owner" TEXT,
    "lease_expires_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_operation_outbox_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "media_operation_outbox_attempts_check" CHECK ("attempts" >= 0),
    CONSTRAINT "media_operation_outbox_payload_check" CHECK (is_valid_media_operation_payload("payload")),
    CONSTRAINT "media_operation_outbox_lease_state_check" CHECK (
      ("status" = ANY (ARRAY['prepared', 'processing']::"media_operation_status"[])
        AND "lease_owner" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
      OR ("status" = ANY (ARRAY['pending', 'completed', 'failed']::"media_operation_status"[])
        AND "lease_owner" IS NULL AND "lease_expires_at" IS NULL)
    )
);

-- Workers claim expired prepared intents or ready pending/processing cleanup work
-- with `FOR UPDATE SKIP LOCKED` ordered by availability.
CREATE INDEX "media_operation_outbox_claim_idx" ON "media_operation_outbox" ("available_at", "lease_expires_at", "created_at")
  WHERE ("status" = ANY (ARRAY['prepared', 'pending', 'processing']::"media_operation_status"[]));

-- Recovers prepared intents whose lease expired before the reference-changing
-- transaction committed (process death between byte creation and reference commit).
CREATE INDEX "media_operation_outbox_prepared_idx" ON "media_operation_outbox" ("lease_expires_at", "created_at")
  WHERE ("status" = 'prepared');

-- Creation rollout gate: every reader must see `mode: 'off'` before any reader
-- starts. Idempotent so redeploying this migration (or reapplying by hand) can
-- never clobber an operator's later change.
INSERT INTO "settings" ("key", "value", "updatedAt")
VALUES ('product_creation', '{"mode": "off"}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
