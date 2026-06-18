import { ApiError, isApiError } from './errors';

describe('ApiError', () => {
  it('captures code, status, title, and detail', () => {
    const err = new ApiError({
      code: 'invalid_credentials',
      status: 401,
      title: 'Invalid credentials',
      detail: 'bad password',
    });
    expect(err.code).toBe('invalid_credentials');
    expect(err.status).toBe(401);
    expect(err.title).toBe('Invalid credentials');
    expect(err.detail).toBe('bad password');
    expect(err.message).toBe('Invalid credentials');
  });

  it('isApiError narrows correctly', () => {
    const e: unknown = new ApiError({ code: 'x', status: 400, title: 'X' });
    expect(isApiError(e)).toBe(true);
    expect(isApiError(new Error('nope'))).toBe(false);
  });
});
