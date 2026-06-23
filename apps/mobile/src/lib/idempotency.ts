// apps/mobile/src/lib/idempotency.ts
let counter = 0;

/** Generates a unique idempotency key for mutation requests. */
export function newIdempotencyKey(): string {
  counter += 1;
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${ts}-${rand}-${counter}`;
}
