import { ZodError } from 'zod';
import type { Problem, ErrorCode } from '@pantry/shared';

export class AppError extends Error {
  status: number;
  code: ErrorCode | string;
  title: string;
  detail?: string | undefined;

  constructor(opts: { status: number; code: ErrorCode | string; title: string; detail?: string }) {
    super(opts.title);
    this.status = opts.status;
    this.code = opts.code;
    this.title = opts.title;
    this.detail = opts.detail;
  }
}

export function toProblem(err: unknown): Problem {
  if (err instanceof AppError) {
    return {
      title: err.title,
      status: err.status,
      code: err.code,
      ...(err.detail !== undefined ? { detail: err.detail } : {}),
    };
  }
  if (err instanceof ZodError) {
    return {
      title: 'Validation failed',
      status: 400,
      code: 'validation_error',
      errors: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
  }
  return {
    title: 'Internal server error',
    status: 500,
    code: 'internal_error',
  };
}
