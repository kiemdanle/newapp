#!/usr/bin/env node
// Phase 7: one-shot CLI wrapper around product-media-freeze.ts, invoked by
// infra/scripts/backup.sh (a separate process from the running pantry-api
// service — see product-media-freeze.ts's header comment for why the freeze
// flag has to live in Redis rather than in-process).
//
// Usage:
//   node dist/scripts/media-freeze-cli.js acquire [drainTimeoutMs]
//   node dist/scripts/media-freeze-cli.js renew <token>
//   node dist/scripts/media-freeze-cli.js release <token>
//
// Exit codes:
//   acquire: 0 = fully drained within the timeout; 1 = timed out with leases
//            still outstanding (printed to stdout as JSON, including the
//            token — save it for renew/release); 3 = a freeze is already
//            held by another run; 2 = usage/other error.
//   renew:   0 = still this token's freeze, TTL extended; 1 = it was NOT (already
//            expired/released/reclaimed by someone else — treat as fatal).
//   release: 0 = always (idempotent — a no-op if this token no longer owns it).
import { disconnectRedis } from '../redis.js';
import {
  acquireMediaFreeze,
  MediaFreezeAlreadyActiveError,
  releaseMediaFreeze,
  renewMediaFreeze,
} from '../services/products/product-media-freeze.js';

async function main(): Promise<number> {
  const [command, arg] = process.argv.slice(2);

  if (command === 'acquire') {
    const timeoutMs = arg ? Number(arg) : 30_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      process.stderr.write('media-freeze-cli: drainTimeoutMs must be a positive number\n');
      return 2;
    }
    try {
      const result = await acquireMediaFreeze(timeoutMs);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      return result.drained ? 0 : 1;
    } catch (err) {
      if (err instanceof MediaFreezeAlreadyActiveError) {
        process.stderr.write('media-freeze-cli: a media freeze is already active (another backup/restore run?)\n');
        return 3;
      }
      throw err;
    }
  }

  if (command === 'renew') {
    if (!arg) {
      process.stderr.write('media-freeze-cli: renew requires <token>\n');
      return 2;
    }
    const stillHeld = await renewMediaFreeze(arg);
    return stillHeld ? 0 : 1;
  }

  if (command === 'release') {
    if (!arg) {
      process.stderr.write('media-freeze-cli: release requires <token>\n');
      return 2;
    }
    await releaseMediaFreeze(arg);
    return 0;
  }

  process.stderr.write('media-freeze-cli: usage: media-freeze-cli.js <acquire [drainTimeoutMs]|renew <token>|release <token>>\n');
  return 2;
}

main()
  .then(async (code) => {
    await disconnectRedis();
    process.exit(code);
  })
  .catch(async (err: unknown) => {
    process.stderr.write(`media-freeze-cli: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    await disconnectRedis().catch(() => {});
    process.exit(2);
  });
