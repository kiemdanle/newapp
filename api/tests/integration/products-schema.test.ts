import { describe, expect, it, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import prismaPkg from '@prisma/client';
import { getPrisma } from '../../src/db.js';
import { makeUser, makeProduct } from '../helpers/factories.js';

const { PrismaClient } = prismaPkg;

const MIGRATIONS_DIR = join(process.cwd(), 'prisma', 'migrations');
const MIGRATION_A1 = '20260726160000_expand_product_lifecycle_enums';
const MIGRATION_A2 = '20260726160100_expand_product_drafts_photos_and_moderation';
const MIGRATION_B = '20260730040000_classify_report_hidden_products';
const MIGRATION_DEFERRABLE = '20260730044500_make_photo_position_deferrable';

function readMigrationSql(name: string): string {
  return readFileSync(join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
}

// `$executeRawUnsafe` sends one prepared statement at a time, so a migration file
// containing several statements (e.g. a `DO $$ ... $$` block followed by an `UPDATE`)
// must be split before execution. Splits on top-level `;` only, ignoring any `;`
// inside a `$$ ... $$` dollar-quoted body or a `--` line comment.
function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = '';
  let insideDollarQuote = false;
  let insideLineComment = false;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]!;
    if (char === '\n') {
      insideLineComment = false;
      current += char;
      continue;
    }
    if (insideLineComment) {
      current += char;
      continue;
    }
    if (!insideDollarQuote && sql.startsWith('--', i)) {
      insideLineComment = true;
      current += '--';
      i++;
      continue;
    }
    if (sql.startsWith('$$', i)) {
      insideDollarQuote = !insideDollarQuote;
      current += '$$';
      i++;
      continue;
    }
    if (char === ';' && !insideDollarQuote) {
      if (current.trim().length > 0) statements.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim().length > 0) statements.push(current.trim());
  return statements;
}

async function runMigrationSql(
  executor: { $executeRawUnsafe: (sql: string) => Promise<unknown> },
  sql: string,
): Promise<void> {
  for (const statement of splitSqlStatements(sql)) {
    await executor.$executeRawUnsafe(statement);
  }
}

async function createValidPhoto(
  productId: string,
  userId: string,
  overrides: Partial<{
    position: number;
    moderationStatus: 'pending' | 'approved' | 'rejected';
    privateStorageKey: string | null;
    publicStorageKey: string | null;
    mimeType: string;
  }> = {},
) {
  const prisma = getPrisma();
  const moderationStatus = overrides.moderationStatus ?? 'pending';
  const isApproved = moderationStatus === 'approved';
  return prisma.productPhoto.create({
    data: {
      productId,
      position: overrides.position ?? 0,
      uploadedByUserId: userId,
      moderationStatus,
      mimeType: overrides.mimeType ?? 'image/webp',
      displayByteSize: 1000,
      displayWidth: 800,
      displayHeight: 600,
      thumbnailByteSize: 100,
      thumbnailWidth: 200,
      thumbnailHeight: 150,
      privateStorageKey:
        overrides.privateStorageKey !== undefined
          ? overrides.privateStorageKey
          : isApproved
            ? null
            : `private/${randomUUID()}.webp`,
      publicStorageKey:
        overrides.publicStorageKey !== undefined
          ? overrides.publicStorageKey
          : isApproved
            ? `public/${randomUUID()}.webp`
            : null,
    },
  });
}

describe('product lifecycle enums (migration A)', () => {
  it('expands ProductStatus without renaming or removing any existing value', async () => {
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = '"ProductStatus"'::regtype
      ORDER BY enumsortorder
    `;
    const labels = rows.map((r) => r.enumlabel);
    expect(labels).toEqual(['active', 'pending', 'merged_into', 'report_hidden', 'draft', 'changes_required']);
  });

  it('expands product_edit_status, preserving rejected as terminal history', async () => {
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum
      WHERE enumtypid = 'product_edit_status'::regtype
      ORDER BY enumsortorder
    `;
    const labels = rows.map((r) => r.enumlabel);
    expect(labels).toEqual(['pending', 'approved', 'rejected', 'draft', 'changes_required']);
  });
});

describe('product_creation setting (idempotent expand insert)', () => {
  it('defaults to mode off, inserted before any reader starts', async () => {
    const prisma = getPrisma();
    const row = await prisma.setting.findUnique({ where: { key: 'product_creation' } });
    expect(row?.value).toEqual({ mode: 'off' });
  });
});

describe('product_photos constraints', () => {
  it('enforces position between 0 and 4', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    await expect(createValidPhoto(product.id, user.id, { position: -1 })).rejects.toThrow();
    await expect(createValidPhoto(product.id, user.id, { position: 5 })).rejects.toThrow();
    await expect(createValidPhoto(product.id, user.id, { position: 4 })).resolves.toBeTruthy();
  });

  it('enforces a unique position per product', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    await createValidPhoto(product.id, user.id, { position: 0 });
    await expect(createValidPhoto(product.id, user.id, { position: 0 })).rejects.toThrow();
  });

  it('requires normalized image/webp', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    await expect(createValidPhoto(product.id, user.id, { mimeType: 'image/jpeg' })).rejects.toThrow();
  });

  it('ties storage keys to moderation status: pending/rejected need only a private key, approved needs only a public key', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    // pending with a public key set instead of private -> violates the check
    await expect(
      createValidPhoto(product.id, user.id, {
        position: 0,
        moderationStatus: 'pending',
        privateStorageKey: null,
        publicStorageKey: 'public/should-not-be-here.webp',
      }),
    ).rejects.toThrow();
    // approved with a private key still set -> violates the check
    await expect(
      createValidPhoto(product.id, user.id, {
        position: 1,
        moderationStatus: 'approved',
        privateStorageKey: 'private/should-not-remain.webp',
      }),
    ).rejects.toThrow();
    // valid pending and valid approved both succeed
    await expect(createValidPhoto(product.id, user.id, { position: 2, moderationStatus: 'pending' })).resolves.toBeTruthy();
    await expect(createValidPhoto(product.id, user.id, { position: 3, moderationStatus: 'approved' })).resolves.toBeTruthy();
  });

  it('makes the product relation immutable once created', async () => {
    const user = await makeUser({ emailVerified: true });
    const productA = await makeProduct();
    const productB = await makeProduct();
    const photo = await createValidPhoto(productA.id, user.id, { position: 0 });
    const prisma = getPrisma();
    await expect(
      prisma.$executeRaw`UPDATE "product_photos" SET "product_id" = ${productB.id}::uuid WHERE "id" = ${photo.id}::uuid`,
    ).rejects.toThrow();
  });

  it('rejects an immediate position swap but allows it once the unique constraint is deferred', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const photo0 = await createValidPhoto(product.id, user.id, { position: 0 });
    const photo1 = await createValidPhoto(product.id, user.id, { position: 1 });
    const prisma = getPrisma();

    // A reorder written as one row per UPDATE statement (the natural shape for a
    // service applying an arbitrary target order) collides on the intermediate state
    // unless the constraint is explicitly deferred: after only the first statement,
    // both rows would momentarily share position 1.
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRaw`UPDATE "product_photos" SET "position" = 1 WHERE "id" = ${photo0.id}::uuid`;
        await tx.$executeRaw`UPDATE "product_photos" SET "position" = 0 WHERE "id" = ${photo1.id}::uuid`;
      }),
    ).rejects.toThrow();

    // Unaffected by the failed attempt above (rolled back).
    const beforeDefer = await prisma.productPhoto.findMany({
      where: { id: { in: [photo0.id, photo1.id] } },
      select: { id: true, position: true },
    });
    expect(beforeDefer.find((p) => p.id === photo0.id)?.position).toBe(0);
    expect(beforeDefer.find((p) => p.id === photo1.id)?.position).toBe(1);

    // Deferred to end-of-transaction, the same two-statement swap succeeds and commits.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET CONSTRAINTS "product_photos_product_id_position_key" DEFERRED`;
      await tx.$executeRaw`UPDATE "product_photos" SET "position" = 1 WHERE "id" = ${photo0.id}::uuid`;
      await tx.$executeRaw`UPDATE "product_photos" SET "position" = 0 WHERE "id" = ${photo1.id}::uuid`;
    });

    const swapped = await prisma.productPhoto.findMany({
      where: { id: { in: [photo0.id, photo1.id] } },
      select: { id: true, position: true },
    });
    expect(swapped.find((p) => p.id === photo0.id)?.position).toBe(1);
    expect(swapped.find((p) => p.id === photo1.id)?.position).toBe(0);
  });
});

describe('product_edit_photos constraints', () => {
  async function createEdit(productId: string, submittedById: string, overrides: Partial<{ isLegacy: boolean }> = {}) {
    const prisma = getPrisma();
    return prisma.productEdit.create({
      data: {
        productId,
        submittedBy: submittedById,
        proposed: {},
        isLegacy: overrides.isLegacy ?? false,
      },
    });
  }

  it('requires exactly a retained source or full staged media, never both or neither', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const photo = await createValidPhoto(product.id, user.id, { position: 0 });
    const edit = await createEdit(product.id, user.id);
    const prisma = getPrisma();

    // neither source nor staged fields
    await expect(
      prisma.productEditPhoto.create({ data: { productEditId: edit.id, position: 0 } }),
    ).rejects.toThrow();

    // both source and staged fields
    await expect(
      prisma.productEditPhoto.create({
        data: {
          productEditId: edit.id,
          position: 0,
          sourceProductPhotoId: photo.id,
          uploadedByUserId: user.id,
          privateStorageKey: 'private/x.webp',
          mimeType: 'image/webp',
          displayByteSize: 1,
          displayWidth: 1,
          displayHeight: 1,
          thumbnailByteSize: 1,
          thumbnailWidth: 1,
          thumbnailHeight: 1,
        },
      }),
    ).rejects.toThrow();

    // retained-only succeeds
    await expect(
      prisma.productEditPhoto.create({
        data: { productEditId: edit.id, position: 0, sourceProductPhotoId: photo.id },
      }),
    ).resolves.toBeTruthy();

    // staged-only succeeds
    await expect(
      prisma.productEditPhoto.create({
        data: {
          productEditId: edit.id,
          position: 1,
          uploadedByUserId: user.id,
          privateStorageKey: 'private/y.webp',
          mimeType: 'image/webp',
          displayByteSize: 10,
          displayWidth: 10,
          displayHeight: 10,
          thumbnailByteSize: 5,
          thumbnailWidth: 5,
          thumbnailHeight: 5,
        },
      }),
    ).resolves.toBeTruthy();
  });

  it('enforces a unique position per edit', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const photo = await createValidPhoto(product.id, user.id, { position: 0 });
    const edit = await createEdit(product.id, user.id);
    const prisma = getPrisma();
    await prisma.productEditPhoto.create({
      data: { productEditId: edit.id, position: 0, sourceProductPhotoId: photo.id },
    });
    await expect(
      prisma.productEditPhoto.create({
        data: { productEditId: edit.id, position: 0, sourceProductPhotoId: photo.id },
      }),
    ).rejects.toThrow();
  });

  it('restricts deleting a product photo retained by an open edit', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const photo = await createValidPhoto(product.id, user.id, { position: 0 });
    const edit = await createEdit(product.id, user.id);
    const prisma = getPrisma();
    await prisma.productEditPhoto.create({
      data: { productEditId: edit.id, position: 0, sourceProductPhotoId: photo.id },
    });
    await expect(prisma.productPhoto.delete({ where: { id: photo.id } })).rejects.toThrow();
  });

  it('rejects a retained photo that belongs to a different product than the edit', async () => {
    const user = await makeUser({ emailVerified: true });
    const productA = await makeProduct();
    const productB = await makeProduct();
    const photoOnB = await createValidPhoto(productB.id, user.id, { position: 0 });
    const editOnA = await createEdit(productA.id, user.id);
    const prisma = getPrisma();
    await expect(
      prisma.productEditPhoto.create({
        data: { productEditId: editOnA.id, position: 0, sourceProductPhotoId: photoOnB.id },
      }),
    ).rejects.toThrow();
  });
});

describe('media_operation_outbox constraints', () => {
  function baseData(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      operation: 'promote_private' as const,
      payload: { keys: ['private/a.webp', 'public/a.webp'] },
      status: 'pending' as const,
      attempts: 0,
      ...overrides,
    };
  }

  it('requires a lease owner/expiry exactly when prepared or processing', async () => {
    const prisma = getPrisma();
    await expect(
      prisma.mediaOperationOutbox.create({ data: baseData({ status: 'prepared' }) }),
    ).rejects.toThrow();
    await expect(
      prisma.mediaOperationOutbox.create({
        data: baseData({ status: 'pending', leaseOwner: 'worker-1', leaseExpiresAt: new Date() }),
      }),
    ).rejects.toThrow();
    await expect(
      prisma.mediaOperationOutbox.create({
        data: baseData({ status: 'prepared', leaseOwner: 'worker-1', leaseExpiresAt: new Date() }),
      }),
    ).resolves.toBeTruthy();
    await expect(prisma.mediaOperationOutbox.create({ data: baseData({ status: 'pending' }) })).resolves.toBeTruthy();
  });

  it('validates the payload shape: a non-empty array of non-blank key strings', async () => {
    const prisma = getPrisma();
    await expect(
      prisma.mediaOperationOutbox.create({ data: baseData({ payload: {} }) }),
    ).rejects.toThrow();
    await expect(
      prisma.mediaOperationOutbox.create({ data: baseData({ payload: { keys: [] } }) }),
    ).rejects.toThrow();
    await expect(
      prisma.mediaOperationOutbox.create({ data: baseData({ payload: { keys: ['   '] } }) }),
    ).rejects.toThrow();
    await expect(
      prisma.mediaOperationOutbox.create({ data: baseData({ payload: { keys: ['ok'] } }) }),
    ).resolves.toBeTruthy();
  });

  it('rejects negative attempts', async () => {
    const prisma = getPrisma();
    await expect(prisma.mediaOperationOutbox.create({ data: baseData({ attempts: -1 }) })).rejects.toThrow();
  });

  it('exposes partial indexes for claiming prepared/pending work and recovering expired leases', async () => {
    const prisma = getPrisma();
    const rows = await prisma.$queryRaw<{ indexname: string }[]>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'media_operation_outbox'
    `;
    const names = rows.map((r) => r.indexname);
    expect(names).toContain('media_operation_outbox_claim_idx');
    expect(names).toContain('media_operation_outbox_prepared_idx');
  });
});

describe('one open lifecycle edit per creator/product', () => {
  it('rejects a second concurrent non-legacy open edit for the same product/creator', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const prisma = getPrisma();
    await prisma.productEdit.create({
      data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: false, status: 'draft' },
    });
    await expect(
      prisma.productEdit.create({
        data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: false, status: 'pending' },
      }),
    ).rejects.toThrow();
  });

  it('exempts legacy edits from the one-open-edit constraint', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const prisma = getPrisma();
    await prisma.productEdit.create({
      data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: true, status: 'pending' },
    });
    await expect(
      prisma.productEdit.create({
        data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: true, status: 'pending' },
      }),
    ).resolves.toBeTruthy();
    // a legacy row never blocks a fresh non-legacy open edit either
    await expect(
      prisma.productEdit.create({
        data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: false, status: 'draft' },
      }),
    ).resolves.toBeTruthy();
  });

  it('lets exactly one of two concurrent inserts win the race', async () => {
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    const prisma = getPrisma();
    const attempt = () =>
      prisma.productEdit.create({
        data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: false, status: 'draft' },
      });
    const results = await Promise.allSettled([attempt(), attempt()]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });
});

describe('migration B classify (tested only inside a rolled-back transaction)', () => {
  it('classifies pending legacy rows as report_hidden without a submission timestamp, then rolls back', async () => {
    const prisma = getPrisma();
    const creator = await makeUser({ emailVerified: true });
    const withoutCreator = await makeProduct();
    await prisma.product.update({ where: { id: withoutCreator.id }, data: { status: 'pending', createdByUserId: null } });
    const withCreator = await makeProduct();
    await prisma.product.update({
      where: { id: withCreator.id },
      data: { status: 'pending', createdByUserId: creator.id },
    });
    const migrationBSql = readMigrationSql(MIGRATION_B);

    const rollbackSentinel = new Error('intentional rollback for a read-only migration-B rehearsal');
    let statusesInsideTransaction: string[] = [];
    await expect(
      prisma.$transaction(async (tx) => {
        await runMigrationSql(tx, migrationBSql);
        const rows = await tx.product.findMany({
          where: { id: { in: [withoutCreator.id, withCreator.id] } },
          select: { status: true },
        });
        statusesInsideTransaction = rows.map((r) => r.status);
        throw rollbackSentinel;
      }),
    ).rejects.toBe(rollbackSentinel);

    expect(statusesInsideTransaction.sort()).toEqual(['report_hidden', 'report_hidden']);

    // Never persisted: the outer connection still sees the original legacy state.
    const after = await prisma.product.findMany({
      where: { id: { in: [withoutCreator.id, withCreator.id] } },
      select: { status: true },
    });
    expect(after.every((r) => r.status === 'pending')).toBe(true);
  });

  it('preflight aborts if a pending row carries a private-draft submission timestamp', async () => {
    const prisma = getPrisma();
    const product = await makeProduct();
    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'pending', submittedAt: new Date() },
    });
    const migrationBSql = readMigrationSql(MIGRATION_B);
    await expect(
      prisma.$transaction(async (tx) => {
        await runMigrationSql(tx, migrationBSql);
      }),
    ).rejects.toThrow(/refusing to classify/);
  });

  it('preflight aborts if product_creation.mode is not off', async () => {
    const prisma = getPrisma();
    await prisma.setting.update({ where: { key: 'product_creation' }, data: { value: { mode: 'internal' } } });
    const product = await makeProduct();
    await prisma.product.update({ where: { id: product.id }, data: { status: 'pending' } });
    const migrationBSql = readMigrationSql(MIGRATION_B);
    await expect(
      prisma.$transaction(async (tx) => {
        await runMigrationSql(tx, migrationBSql);
      }),
    ).rejects.toThrow(/product_creation.mode is not off/);
  });

  it('preflight aborts if a pending row carries a moderation marker', async () => {
    const prisma = getPrisma();
    const admin = await makeUser({ role: 'admin', emailVerified: true });
    const product = await makeProduct();
    await prisma.product.update({
      where: { id: product.id },
      data: { status: 'pending', moderatedAt: new Date(), moderatedByUserId: admin.id },
    });
    const migrationBSql = readMigrationSql(MIGRATION_B);
    await expect(
      prisma.$transaction(async (tx) => {
        await runMigrationSql(tx, migrationBSql);
      }),
    ).rejects.toThrow(/moderation marker/);
  });

  it('preflight aborts if a pending row has version > 1', async () => {
    const prisma = getPrisma();
    const product = await makeProduct();
    await prisma.product.update({ where: { id: product.id }, data: { status: 'pending', version: 2 } });
    const migrationBSql = readMigrationSql(MIGRATION_B);
    await expect(
      prisma.$transaction(async (tx) => {
        await runMigrationSql(tx, migrationBSql);
      }),
    ).rejects.toThrow(/version > 1/);
  });

  it('preflight aborts if a pending row has any product_photos row', async () => {
    const prisma = getPrisma();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    await prisma.product.update({ where: { id: product.id }, data: { status: 'pending' } });
    await createValidPhoto(product.id, user.id, { position: 0 });
    const migrationBSql = readMigrationSql(MIGRATION_B);
    await expect(
      prisma.$transaction(async (tx) => {
        await runMigrationSql(tx, migrationBSql);
      }),
    ).rejects.toThrow(/product_photos rows/);
  });

  it('preflight aborts if a pending row has a non-legacy product_edits row', async () => {
    const prisma = getPrisma();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    await prisma.product.update({ where: { id: product.id }, data: { status: 'pending' } });
    await prisma.productEdit.create({
      data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: false },
    });
    const migrationBSql = readMigrationSql(MIGRATION_B);
    await expect(
      prisma.$transaction(async (tx) => {
        await runMigrationSql(tx, migrationBSql);
      }),
    ).rejects.toThrow(/non-legacy product_edits row/);
  });

  it('does not abort on a legacy product_edits row (historical pending/approved/rejected)', async () => {
    const prisma = getPrisma();
    const user = await makeUser({ emailVerified: true });
    const product = await makeProduct();
    await prisma.product.update({ where: { id: product.id }, data: { status: 'pending' } });
    await prisma.productEdit.create({
      data: { productId: product.id, submittedBy: user.id, proposed: {}, isLegacy: true, status: 'approved' },
    });
    const migrationBSql = readMigrationSql(MIGRATION_B);
    let statusInsideTransaction: string | undefined;
    const rollbackSentinel = new Error('intentional rollback for a read-only migration-B rehearsal');
    await expect(
      prisma.$transaction(async (tx) => {
        await runMigrationSql(tx, migrationBSql);
        const row = await tx.product.findUniqueOrThrow({ where: { id: product.id }, select: { status: true } });
        statusInsideTransaction = row.status;
        throw rollbackSentinel;
      }),
    ).rejects.toBe(rollbackSentinel);
    expect(statusInsideTransaction).toBe('report_hidden');
  });
});

describe('upgrade fixture: pre-phase-1 rows survive migration A unchanged', () => {
  const scratchDbName = `pantry_test_upgrade_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  // Prisma URLs carry a `?schema=` query param that plain `psql` doesn't understand as
  // a libpq connection option, so admin/DDL work over psql uses the bare URL while the
  // scratch Prisma client below uses the Prisma-flavored one.
  const baseUrl = (process.env.DATABASE_URL ?? '').replace(/\/[^/]+(\?.*)?$/, '');
  const adminUrl = `${baseUrl}/postgres`;
  const scratchUrlForPsql = `${baseUrl}/${scratchDbName}`;
  const scratchUrlForPrisma = `${scratchUrlForPsql}?schema=public`;
  let scratchPrisma: InstanceType<typeof PrismaClient> | undefined;

  function psql(url: string, args: string[]) {
    execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', ...args], { stdio: 'pipe' });
  }

  afterAll(async () => {
    if (scratchPrisma) await scratchPrisma.$disconnect();
    try {
      psql(adminUrl, ['-c', `DROP DATABASE IF EXISTS "${scratchDbName}"`]);
    } catch {
      // best-effort cleanup; a leaked scratch DB from a failed run is not load-bearing
    }
  });

  it('preserves existing pending/approved/rejected product_edits and legacy report-hidden products through migration A', async () => {
    psql(adminUrl, ['-c', `CREATE DATABASE "${scratchDbName}" OWNER pantry_app`]);
    psql(scratchUrlForPsql, ['-c', 'CREATE EXTENSION IF NOT EXISTS pg_trgm']);

    const migrationNames = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => ![MIGRATION_A1, MIGRATION_A2, MIGRATION_B, MIGRATION_DEFERRABLE].includes(name))
      .sort();
    for (const name of migrationNames) {
      psql(scratchUrlForPsql, ['-f', join(MIGRATIONS_DIR, name, 'migration.sql')]);
    }

    scratchPrisma = new PrismaClient({ datasources: { db: { url: scratchUrlForPrisma } } });
    const userId = randomUUID();
    await scratchPrisma.$executeRawUnsafe(
      `INSERT INTO "users" (id, email, "firstName", "lastName", role, status, "updatedAt") VALUES ($1::uuid, $2, 'Legacy', 'User', 'user', 'active', CURRENT_TIMESTAMP)`,
      userId,
      `legacy-${randomUUID()}@test.local`,
    );

    const productNoCreatorId = randomUUID();
    const productWithCreatorId = randomUUID();
    await scratchPrisma.$executeRawUnsafe(
      `INSERT INTO "products" (id, name, source, status, created_by_user_id, updated_at) VALUES ($1::uuid, 'Legacy hidden A', 'user', 'pending', NULL, CURRENT_TIMESTAMP)`,
      productNoCreatorId,
    );
    await scratchPrisma.$executeRawUnsafe(
      `INSERT INTO "products" (id, name, source, status, created_by_user_id, updated_at) VALUES ($1::uuid, 'Legacy hidden B', 'user', 'pending', $2::uuid, CURRENT_TIMESTAMP)`,
      productWithCreatorId,
      userId,
    );

    const editPendingId = randomUUID();
    const editApprovedId = randomUUID();
    const editRejectedId = randomUUID();
    for (const [id, status] of [
      [editPendingId, 'pending'],
      [editApprovedId, 'approved'],
      [editRejectedId, 'rejected'],
    ] as const) {
      await scratchPrisma.$executeRawUnsafe(
        `INSERT INTO "product_edits" (id, product_id, submitted_by, proposed, status) VALUES ($1::uuid, $2::uuid, $3::uuid, '{}'::jsonb, $4::"product_edit_status")`,
        id,
        productWithCreatorId,
        userId,
        status,
      );
    }

    psql(scratchUrlForPsql, ['-f', join(MIGRATIONS_DIR, MIGRATION_A1, 'migration.sql')]);
    psql(scratchUrlForPsql, ['-f', join(MIGRATIONS_DIR, MIGRATION_A2, 'migration.sql')]);
    psql(scratchUrlForPsql, ['-f', join(MIGRATIONS_DIR, MIGRATION_DEFERRABLE, 'migration.sql')]);

    const products = await scratchPrisma.product.findMany({
      where: { id: { in: [productNoCreatorId, productWithCreatorId] } },
      orderBy: { name: 'asc' },
    });
    expect(products).toHaveLength(2);
    expect(products.every((p) => p.status === 'pending')).toBe(true);
    expect(products.find((p) => p.id === productNoCreatorId)?.createdByUserId).toBeNull();
    expect(products.find((p) => p.id === productWithCreatorId)?.createdByUserId).toBe(userId);

    const edits = await scratchPrisma.productEdit.findMany({
      where: { id: { in: [editPendingId, editApprovedId, editRejectedId] } },
      orderBy: { status: 'asc' },
    });
    expect(edits).toHaveLength(3);
    expect(edits.map((e) => e.status).sort()).toEqual(['approved', 'pending', 'rejected']);
    // Backfilled defaults for the new columns, and exempt from the new constraint.
    expect(edits.every((e) => e.isLegacy === true)).toBe(true);
    expect(edits.every((e) => e.version === 1)).toBe(true);
    expect(edits.every((e) => e.baseProductVersion === 1)).toBe(true);

    const settingsRow = await scratchPrisma.setting.findUnique({ where: { key: 'product_creation' } });
    expect(settingsRow?.value).toEqual({ mode: 'off' });
  });
});
