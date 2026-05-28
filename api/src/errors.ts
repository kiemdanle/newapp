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

interface FastifyLikeError {
  statusCode?: number;
  code?: string;
  message?: string;
}

function isFastifyLikeError(err: unknown): err is FastifyLikeError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { statusCode?: unknown }).statusCode === 'number'
  );
}

function codeForStatus(status: number): string {
  if (status === 429) return 'rate_limited';
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status >= 400 && status < 500) return 'bad_request';
  return 'internal_error';
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
  // Fastify (and plugins like @fastify/rate-limit) throw errors with statusCode set;
  // surface them with the correct HTTP status and a stable problem code instead of
  // collapsing every framework error into a generic 500.
  if (isFastifyLikeError(err) && err.statusCode && err.statusCode >= 400 && err.statusCode < 600) {
    const status = err.statusCode;
    return {
      title: err.message ?? 'Request error',
      status,
      code: codeForStatus(status),
    };
  }
  return {
    title: 'Internal server error',
    status: 500,
    code: 'internal_error',
  };
}
