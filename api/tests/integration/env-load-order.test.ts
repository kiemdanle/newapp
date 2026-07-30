// Regression test for the env-load-order bug (task: "Fix test-infra env-load ordering
// quirk"). The bug only ever showed up when a `vi.doMock`+`vi.resetModules()` file was
// the FIRST (or only) file to run in its process — a normal in-suite run of the repro
// fixture can't prove that, since by definition it isn't running alone. This spawns a
// genuinely fresh `vitest run` process with the repro fixture as its ONLY file, exactly
// reproducing the originally-reported conditions.
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('isolated single-file test runs are deterministic (env load order)', () => {
  it('running the repro fixture alone, as the first file in a fresh process, still passes', () => {
    let output = '';
    let failed = false;
    try {
      output = execFileSync(
        'pnpm',
        ['exec', 'vitest', 'run', 'tests/integration/env-load-order-repro.test.ts'],
        {
          cwd: process.cwd(),
          encoding: 'utf8',
          timeout: 30_000,
          env: process.env,
        },
      );
    } catch (err) {
      failed = true;
      output = String((err as { stdout?: string }).stdout ?? err);
    }
    expect(failed, `child vitest run failed:\n${output}`).toBe(false);
    expect(output).toMatch(/1 passed/);
  });
});
