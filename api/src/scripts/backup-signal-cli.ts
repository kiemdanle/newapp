#!/usr/bin/env node
// Phase 7: records backup.sh's own success/failure into the same Redis
// signal store the operational health endpoint reads from. backup.sh runs
// as a host-level cron, never through the API's HTTP layer, so this is the
// same one-shot-CLI-talking-to-shared-Redis pattern as media-freeze-cli.ts.
//
// Usage:
//   node dist/scripts/backup-signal-cli.js success
//   node dist/scripts/backup-signal-cli.js failure
import { disconnectRedis } from '../redis.js';
import { recordBackupFailure, recordBackupSuccess } from '../services/products/product-operational-health.js';

async function main(): Promise<number> {
  const [command] = process.argv.slice(2);
  if (command === 'success') {
    await recordBackupSuccess();
    return 0;
  }
  if (command === 'failure') {
    await recordBackupFailure();
    return 0;
  }
  process.stderr.write('backup-signal-cli: usage: backup-signal-cli.js <success|failure>\n');
  return 2;
}

main()
  .then(async (code) => {
    await disconnectRedis();
    process.exit(code);
  })
  .catch(async (err: unknown) => {
    process.stderr.write(`backup-signal-cli: ${err instanceof Error ? err.stack ?? err.message : String(err)}\n`);
    await disconnectRedis().catch(() => {});
    process.exit(2);
  });
