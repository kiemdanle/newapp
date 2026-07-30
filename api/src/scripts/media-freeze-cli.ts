#!/usr/bin/env node
// Phase 7: one-shot CLI wrapper around product-media-freeze.ts, invoked by
// infra/scripts/backup.sh (a separate process from the running pantry-api
// service — see product-media-freeze.ts's header comment for why the freeze
// flag has to live in Redis rather than in-process).
//
// Usage:
//   node dist/scripts/media-freeze-cli.js acquire [drainTimeoutMs]
//   node dist/scripts/media-freeze-cli.js release
//
// Exit codes:
//   acquire: 0 = fully drained within the timeout; 1 = timed out with leases
//            still outstanding (printed to stderr as JSON); 2 = usage/other error.
//   release: 0 = always (idempotent).
import { disconnectRedis } from '../redis.js';
import { acquireMediaFreeze, releaseMediaFreeze } from '../services/products/product-media-freeze.js';

async function main(): Promise<number> {
  const [command, arg] = process.argv.slice(2);

  if (command === 'acquire') {
    const timeoutMs = arg ? Number(arg) : 30_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      process.stderr.write('media-freeze-cli: drainTimeoutMs must be a positive number\n');
      return 2;
    }
    const result = await acquireMediaFreeze(timeoutMs);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.drained ? 0 : 1;
  }

  if (command === 'release') {
    await releaseMediaFreeze();
    return 0;
  }

  process.stderr.write('media-freeze-cli: usage: media-freeze-cli.js <acquire [drainTimeoutMs]|release>\n');
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
