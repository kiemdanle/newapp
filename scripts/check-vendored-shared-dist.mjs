#!/usr/bin/env node
// scripts/check-vendored-shared-dist.mjs
//
// Guards against the failure class hit three times already: a hand-resync of
// `apps/mobile/local-packages/@expyrico/shared/dist` (the mobile app's
// vendored, committed copy of the built `@expyrico/shared` package — mobile
// can't consume the workspace source directly) either captured uncommitted
// working-tree schema changes, or lagged already-committed source changes,
// and only "self-healed" once a later commit happened to resync it. This
// rebuilds `packages/shared` from its currently-committed(-or-working-tree)
// source and diffs the result against the vendored copy, so drift fails a
// gate instead of surfacing as a confusing runtime/typecheck error days
// later in an unrelated review.
//
// Usage: node scripts/check-vendored-shared-dist.mjs
// Exit 0 = in sync. Exit 1 = drift found (details printed).

import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const sourceDist = join(repoRoot, 'packages/shared/dist');
const vendoredDist = join(repoRoot, 'apps/mobile/local-packages/@expyrico/shared/dist');

function listFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

// A union type's member order is not semantically meaningful (`"a" | "b"`
// and `"b" | "a"` are the same type), but `tsc` doesn't always emit them in
// a stable order across otherwise-identical builds — this reorders the
// pipe-separated members within a single line (quoted string literals or
// bare identifiers, e.g. a trailing `undefined` on an optional property) so
// two structurally-identical declarations compare equal regardless of that
// emit-order nondeterminism. Matches only inside `.d.ts` lines, which are
// pure type declarations — `|` never means anything but a union there.
function canonicalizeUnionMemberOrder(line) {
  return line.replace(
    /(?:"[^"]*"|[A-Za-z_$][\w$]*)(?:\s*\|\s*(?:"[^"]*"|[A-Za-z_$][\w$]*))+/g,
    (unionExpr) => unionExpr.split('|').map((member) => member.trim()).sort().join(' | '),
  );
}

// `.d.ts.map`/`.js.map` source maps embed an absolute `sourceRoot`/`sources`
// path that differs by checkout location and carries no runtime meaning —
// never worth failing the gate over. `.d.ts` declaration order can shuffle
// harmlessly across TypeScript versions without any actual type change, and
// individual union members within one declaration can too (see
// `canonicalizeUnionMemberOrder` above), so those compare as a sorted set of
// trimmed, union-canonicalized, non-empty lines rather than exact bytes.
// `.js` runtime files compare byte-for-byte: any difference there is real,
// load-bearing drift.
function normalizedContent(path) {
  const raw = readFileSync(path, 'utf8');
  if (path.endsWith('.map')) return null; // never compared
  if (path.endsWith('.d.ts')) {
    return raw
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map(canonicalizeUnionMemberOrder)
      .sort()
      .join('\n');
  }
  return raw; // .js — exact
}

function main() {
  console.log('[check-vendored-shared-dist] Building packages/shared from current source...');
  execFileSync('pnpm', ['--dir', 'packages/shared', 'build'], { cwd: repoRoot, stdio: 'inherit' });

  const sourceFiles = listFiles(sourceDist).map((f) => relative(sourceDist, f));
  const vendoredFiles = listFiles(vendoredDist).map((f) => relative(vendoredDist, f));
  const comparable = (rel) => !rel.endsWith('.map');

  const sourceSet = new Set(sourceFiles.filter(comparable));
  const vendoredSet = new Set(vendoredFiles.filter(comparable));

  const missingFromVendored = [...sourceSet].filter((f) => !vendoredSet.has(f));
  const extraInVendored = [...vendoredSet].filter((f) => !sourceSet.has(f));
  const contentDrift = [];

  for (const rel of sourceSet) {
    if (!vendoredSet.has(rel)) continue;
    const a = normalizedContent(join(sourceDist, rel));
    const b = normalizedContent(join(vendoredDist, rel));
    if (a !== null && a !== b) contentDrift.push(rel);
  }

  if (missingFromVendored.length === 0 && extraInVendored.length === 0 && contentDrift.length === 0) {
    console.log('[check-vendored-shared-dist] OK — vendored dist matches a fresh build of packages/shared.');
    return;
  }

  console.error('[check-vendored-shared-dist] DRIFT DETECTED between packages/shared/dist and the vendored mobile copy.');
  if (missingFromVendored.length > 0) {
    console.error('  Missing from vendored copy (resync needed):');
    for (const f of missingFromVendored) console.error(`    ${f}`);
  }
  if (extraInVendored.length > 0) {
    console.error('  Present in vendored copy but not in a fresh build (stale/removed export?):');
    for (const f of extraInVendored) console.error(`    ${f}`);
  }
  if (contentDrift.length > 0) {
    console.error('  Content differs from a fresh build:');
    for (const f of contentDrift) console.error(`    ${f}`);
  }
  console.error('\nFix: pnpm --dir packages/shared build && rsync -a --delete packages/shared/dist/ apps/mobile/local-packages/@expyrico/shared/dist/');
  process.exitCode = 1;
}

main();
