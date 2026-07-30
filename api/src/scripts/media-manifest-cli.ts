#!/usr/bin/env node
// Phase 7: referenced-media manifest generation and verification, invoked by
// infra/scripts/backup.sh (generate, before packaging) and
// infra/scripts/restore.sh (verify, against the staged media root before any
// cutover). A "referenced" key is exactly the set of private/public storage
// keys currently live on a ProductPhoto or ProductEditPhoto row — quarantine
// is deliberately never included, matching the spec's "quarantine excluded"
// backup boundary.
//
// Usage:
//   node dist/scripts/media-manifest-cli.js generate <mediaRoot> <outFile>
//   node dist/scripts/media-manifest-cli.js verify <mediaRoot> <manifestFile>
//   node dist/scripts/media-manifest-cli.js verify-db-refs <manifestFile>
//
// `verify-db-refs` connects via whatever DATABASE_URL is set in its own
// process env (restore.sh runs it with DATABASE_URL pointed at the STAGING
// database, never live) and asserts the manifest's key set is *exactly* the
// staged database's referenced key set — every DB-referenced key has a
// manifest entry, and every manifest entry is actually referenced. Without
// this, a db.dump paired with a foreign manifest+tar (e.g. `restic restore`
// picking an arbitrary db.dump via `find -name db.dump -print -quit` when a
// snapshot holds more than one) validates cleanly against the file-checksum
// `verify` above, which only ever checks manifest -> file, never database ->
// manifest (reviewer-p7 II2).
//
// Exit codes: 0 = success (generate: manifest written; verify/verify-db-refs:
// every entry matched); 1 = verify found a missing/mismatched file, or
// verify-db-refs found a set mismatch (details on stdout as JSON); 2 =
// usage/other error.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve, sep } from 'node:path';
import sharp from 'sharp';
import { getPrisma } from '../db.js';
import { disconnectPrisma } from '../db.js';

interface ManifestEntry {
  key: string;
  variant: 'display' | 'thumb';
  path: string;
  sha256: string;
  bytes: number;
}

interface Manifest {
  generatedAt: string;
  entries: ManifestEntry[];
}

async function sha256File(path: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash('sha256');
  let bytes = 0;
  await new Promise<void>((resolvePromise, reject) => {
    const stream = createReadStream(path);
    stream.on('data', (chunk: string | Buffer) => {
      const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
      bytes += buf.length;
      hash.update(buf);
    });
    stream.on('end', () => resolvePromise());
    stream.on('error', reject);
  });
  return { sha256: hash.digest('hex'), bytes };
}

/** Every storage key is a server-generated UUID-segment prefix (never
 * client-influenced) resolving to exactly two files: display.webp and
 * thumb.webp. Mirrors `product-media-storage.ts`'s `mediaKeyToPath`/
 * `variantFileKey`, reimplemented here rather than imported so this script
 * has zero dependency on config/media root validation at import time — it
 * takes mediaRoot as an explicit CLI argument instead. */
function keyToVariantPaths(mediaRoot: string, key: string): { display: string; thumb: string } {
  const base = resolve(mediaRoot, key.replace(/^\/+/, ''));
  if (!(base + sep).startsWith(resolve(mediaRoot) + sep)) {
    throw new Error(`refusing to resolve a storage key outside mediaRoot: ${key}`);
  }
  return { display: `${base}/display.webp`, thumb: `${base}/thumb.webp` };
}

async function collectReferencedKeys(): Promise<string[]> {
  const prisma = getPrisma();
  const [photos, editPhotos] = await Promise.all([
    prisma.productPhoto.findMany({ select: { privateStorageKey: true, publicStorageKey: true } }),
    prisma.productEditPhoto.findMany({ select: { privateStorageKey: true } }),
  ]);
  const keys = new Set<string>();
  for (const p of photos) {
    if (p.privateStorageKey) keys.add(p.privateStorageKey);
    if (p.publicStorageKey) keys.add(p.publicStorageKey);
  }
  for (const p of editPhotos) {
    if (p.privateStorageKey) keys.add(p.privateStorageKey);
  }
  return [...keys];
}

async function generate(mediaRoot: string, outFile: string): Promise<number> {
  const keys = await collectReferencedKeys();
  const entries: ManifestEntry[] = [];
  for (const key of keys) {
    const { display, thumb } = keyToVariantPaths(mediaRoot, key);
    for (const [variant, path] of [['display', display], ['thumb', thumb]] as const) {
      const { sha256, bytes } = await sha256File(path);
      entries.push({ key, variant, path: path.slice(mediaRoot.length), sha256, bytes });
    }
  }
  const manifest: Manifest = { generatedAt: new Date().toISOString(), entries };
  await writeFile(outFile, JSON.stringify(manifest, null, 2));
  process.stdout.write(`${JSON.stringify({ keys: keys.length, entries: entries.length })}\n`);
  return 0;
}

async function verify(mediaRoot: string, manifestFile: string): Promise<number> {
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Manifest;
  const problems: Array<{ path: string; problem: string }> = [];
  for (const entry of manifest.entries) {
    const fullPath = resolve(mediaRoot, entry.path.replace(/^\/+/, ''));
    try {
      const { sha256, bytes } = await sha256File(fullPath);
      if (sha256 !== entry.sha256) problems.push({ path: entry.path, problem: 'checksum_mismatch' });
      if (bytes !== entry.bytes) problems.push({ path: entry.path, problem: 'size_mismatch' });
    } catch {
      problems.push({ path: entry.path, problem: 'missing' });
    }
  }
  process.stdout.write(`${JSON.stringify({ checked: manifest.entries.length, problems })}\n`);
  return problems.length === 0 ? 0 : 1;
}

/**
 * Cross-checks the manifest's key set against `collectReferencedKeys()` run
 * against whatever database this process's `DATABASE_URL` points at —
 * restore.sh always runs this against the staging database, never live
 * (reviewer-p7 II2). Reports both directions of mismatch: a key the database
 * references but the manifest never captured (an incomplete/foreign
 * manifest), and a key the manifest lists but no live row references (a
 * foreign/stale manifest paired with the wrong database).
 */
async function verifyDbReferences(manifestFile: string): Promise<number> {
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Manifest;
  const manifestKeys = new Set(manifest.entries.map((e) => e.key));
  const dbKeys = new Set(await collectReferencedKeys());

  const missingFromManifest = [...dbKeys].filter((k) => !manifestKeys.has(k)).sort();
  const extraInManifest = [...manifestKeys].filter((k) => !dbKeys.has(k)).sort();

  process.stdout.write(
    `${JSON.stringify({ dbKeys: dbKeys.size, manifestKeys: manifestKeys.size, missingFromManifest, extraInManifest })}\n`,
  );
  return missingFromManifest.length === 0 && extraInManifest.length === 0 ? 0 : 1;
}

/** Real-decode sanity check on a random sample of the manifest, independent
 * of the checksum path above: a byte-identical copy of an already-corrupt
 * source would pass checksum verification but never decode. Never trusts a
 * static format flag — actually calls into libvips, same principle as
 * `product-image-processor.ts`'s HEIC capability probe. */
async function decodeSample(mediaRoot: string, manifestFile: string, sampleSize = 20): Promise<number> {
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8')) as Manifest;
  const shuffled = [...manifest.entries].sort(() => Math.random() - 0.5);
  const sample = shuffled.slice(0, sampleSize);
  const failures: Array<{ path: string; error: string }> = [];
  for (const entry of sample) {
    const fullPath = resolve(mediaRoot, entry.path.replace(/^\/+/, ''));
    try {
      await sharp(fullPath).metadata();
    } catch (err) {
      failures.push({ path: entry.path, error: err instanceof Error ? err.message : String(err) });
    }
  }
  process.stdout.write(`${JSON.stringify({ sampled: sample.length, failures })}\n`);
  return failures.length === 0 ? 0 : 1;
}

const USAGE =
  'media-manifest-cli: usage: media-manifest-cli.js <generate|verify|decode-sample> <mediaRoot> <file> [sampleSize] | media-manifest-cli.js verify-db-refs <manifestFile>\n';

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);

  if (command === 'verify-db-refs') {
    const [manifestFile] = rest;
    if (!manifestFile) {
      process.stderr.write(USAGE);
      return 2;
    }
    return verifyDbReferences(manifestFile);
  }

  const [mediaRoot, target, sampleArg] = rest;
  if (!mediaRoot || !target) {
    process.stderr.write(USAGE);
    return 2;
  }
  if (command === 'generate') return generate(mediaRoot, target);
  if (command === 'verify') return verify(mediaRoot, target);
  if (command === 'decode-sample') return decodeSample(mediaRoot, target, sampleArg ? Number(sampleArg) : undefined);
  process.stderr.write(USAGE);
  return 2;
}

main()
  .then(async (code) => {
    await disconnectPrisma();
    process.exit(code);
  })
  .catch(async (err: unknown) => {
    process.stderr.write(`media-manifest-cli: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    await disconnectPrisma().catch(() => {});
    process.exit(2);
  });
