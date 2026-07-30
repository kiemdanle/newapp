export interface ApiErrorOptions {
  code: string;
  status: number;
  title: string;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
  // Carried by typed structured conflicts (409 version_conflict) so a caller
  // — the Phase 5 mutation coordinator, in particular — can refetch and merge
  // against the server's actual current state without a second round trip
  // just to learn what it is.
  currentVersion?: number;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly title: string;
  readonly detail?: string;
  readonly errors?: Array<{ path: string; message: string }>;
  readonly currentVersion?: number;

  constructor(opts: ApiErrorOptions) {
    super(opts.title);
    this.name = 'ApiError';
    this.code = opts.code;
    this.status = opts.status;
    this.title = opts.title;
    this.detail = opts.detail;
    this.errors = opts.errors;
    this.currentVersion = opts.currentVersion;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
