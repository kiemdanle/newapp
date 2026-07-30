// Standalone child process for the real subprocess-kill crash-recovery test
// (see product-media-outbox-crash.test.ts). Run under `tsx` with DATABASE_URL,
// MEDIA_ROOT, and PHOTO_PREFIX already set in its environment by the parent test.
//
// Commits a `prepared` media-operation intent, promotes real bytes into their
// final private key (exactly what `addProductPhoto` does before ever writing the
// DB reference), then prints a sentinel line and blocks forever — simulating a
// process that dies between "bytes exist" and "reference transaction ran". The
// parent test SIGKILLs this process right after seeing the sentinel, so nothing
// here ever gets a chance to run a graceful shutdown/cleanup handler.
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { getPrisma } from '../../../src/db.js';
import { prepareMediaOperation } from '../../../src/services/products/product-media-outbox.js';
import { promoteKeyPrefix, quarantineDirKey, writeQuarantineFile } from '../../../src/services/products/product-media-storage.js';

async function main() {
  const root = process.env.MEDIA_ROOT!;
  const prefix = process.env.PHOTO_PREFIX!;
  const prisma = getPrisma();

  const requestId = randomUUID();
  await writeQuarantineFile(root, requestId, Readable.from(Buffer.from('crash-test-bytes')), 10_000);

  // A short lease so the parent test doesn't have to wait out the real production
  // TTL for recovery to become eligible — the point under test is that recovery
  // converges *at all* after a real, uncontrolled process death, not the exact
  // wall-clock lease duration (which the non-crash outbox tests already cover).
  await prisma.$transaction((tx) => prepareMediaOperation(tx, { operation: 'promote_private', keys: [prefix], leaseTtlSeconds: -1 }));
  await promoteKeyPrefix(root, quarantineDirKey(requestId), prefix);

  // Sentinel for the parent: bytes are on disk, intent is committed, and this
  // process is about to be killed before it ever runs the reference transaction.
  console.log('READY');
  await new Promise(() => {}); // block forever; the parent sends SIGKILL
}

main().catch((err) => {
  console.error('CHILD_ERROR', err);
  process.exit(1);
});
