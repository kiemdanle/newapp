export interface ApiErrorOptions {
  code: string;
  status: number;
  title: string;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: Array<{ path: string; message: string }>;

  constructor(opts: ApiErrorOptions) {
    super(opts.title);
    this.name = 'ApiError';
    this.code = opts.code;
    this.status = opts.status;
    this.title = opts.title;
    this.detail = opts.detail;
    this.errors = opts.errors;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
