import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetConfigForTests } from '../../src/config.js';
import { privateProductPhotoPrefix, mediaKeyToPath } from '../../src/services/products/product-media-storage.js';
import { processMediaOutboxOnce } from '../../src/services/products/product-media-outbox.js';
import { getPrisma } from '../../src/db.js';

let root: string;
const baseEnv = { ...process.env };

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'outbox-crash-test-'));
  // The parent test process's own config must also point at `root` — the outbox
  // sweep below runs in *this* process, not the child, and needs to resolve keys
  // under the same directory the child actually wrote bytes into.
  process.env.MEDIA_ROOT = root;
  resetConfigForTests();
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  process.env = { ...baseEnv };
  resetConfigForTests();
});

async function pathExists(key: string): Promise<boolean> {
  try {
    await stat(mediaKeyToPath(root, key));
    return true;
  } catch {
    return false;
  }
}

/**
 * The one real subprocess-kill test for the phase's single most load-bearing
 * claim: a `prepared` media-operation intent survives a genuine, uncontrolled
 * process death between "bytes written to their final key" and "the reference
 * transaction that was supposed to complete the intent". Everywhere else in this
 * phase's suite proves this with direct fault injection (fast, deterministic); this
 * one spawns a real Node child, lets it commit the intent and promote real bytes,
 * then SIGKILLs it with no chance to run any cleanup — the closest thing to an
 * actual crash this test harness can produce — and asserts the durable outbox
 * recovery path (not the killed process) is what converges the system to a
 * consistent state.
 */
describe('prepared-intent recovery — real process crash', () => {
  it('recovers unreferenced bytes left by a child process that was SIGKILLed after promotion but before the reference transaction', async () => {
    const prefix = privateProductPhotoPrefix(randomUUID(), randomUUID(), randomUUID());
    const childScript = fileURLToPath(new URL('./fixtures/prepared-intent-crash-child.ts', import.meta.url));

    const child = spawn(process.execPath, ['--import', 'tsx', childScript], {
      cwd: process.cwd(),
      env: { ...process.env, MEDIA_ROOT: root, PHOTO_PREFIX: prefix },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    const ready = await new Promise<boolean>((resolve, reject) => {
      let buffered = '';
      const timeout = setTimeout(() => reject(new Error(`child never became ready; stderr: ${stderr}`)), 15_000);
      child.stdout.on('data', (chunk: Buffer) => {
        buffered += chunk.toString();
        if (buffered.includes('READY')) {
          clearTimeout(timeout);
          resolve(true);
        }
      });
      child.on('exit', (code) => {
        clearTimeout(timeout);
        if (!buffered.includes('READY')) reject(new Error(`child exited (${code}) before READY; stderr: ${stderr}`));
      });
    });
    expect(ready).toBe(true);

    // Bytes are on disk and the intent is committed at this point (the child proved
    // it by printing READY). Kill it with no chance to run any cleanup — closer to a
    // real crash than anything a fault-injection unit test can simulate.
    const exited = new Promise<void>((resolve) => child.on('exit', () => resolve()));
    child.kill('SIGKILL');
    await exited;

    expect(await pathExists(prefix)).toBe(true); // bytes really were left behind

    const swept = await processMediaOutboxOnce(10);
    expect(swept.claimed).toBe(1);
    expect(swept.completed).toBe(1);
    expect(await pathExists(prefix)).toBe(false); // recovered, not left orphaned

    // The killed connection didn't wedge anything for the rest of the suite.
    await expect(getPrisma().mediaOperationOutbox.count()).resolves.toBeGreaterThanOrEqual(0);
  }, 30_000);
});
