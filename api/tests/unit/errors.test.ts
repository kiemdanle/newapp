import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AppError, toProblem } from '../../src/errors.js';

describe('toProblem', () => {
  it('maps AppError', () => {
    const err = new AppError({ status: 404, code: 'not_found', title: 'Not found' });
    const p = toProblem(err);
    expect(p.status).toBe(404);
    expect(p.code).toBe('not_found');
    expect(p.title).toBe('Not found');
  });

  it('maps ZodError to 400 validation_error with field paths', () => {
    const schema = z.object({ email: z.string().email() });
    const result = schema.safeParse({ email: 'nope' });
    if (result.success) throw new Error('expected failure');
    const p = toProblem(result.error);
    expect(p.status).toBe(400);
    expect(p.code).toBe('validation_error');
    expect(p.errors?.[0]?.path).toBe('email');
  });

  it('maps unknown error to 500', () => {
    const p = toProblem(new Error('boom'));
    expect(p.status).toBe(500);
    expect(p.code).toBe('internal_error');
  });
});
