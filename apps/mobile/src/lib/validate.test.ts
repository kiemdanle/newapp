import { fieldErrors } from './validate';
import { registerSchema } from '@expyrico/shared';

describe('fieldErrors', () => {
  it('returns empty object when input is valid', () => {
    const errs = fieldErrors(registerSchema, {
      email: 'a@b.co',
      password: 'correct-horse-battery-staple',
      firstName: 'A',
      lastName: 'B',
    });
    expect(errs).toEqual({});
  });

  it('returns per-field error messages when invalid', () => {
    const errs = fieldErrors(registerSchema, {
      email: 'nope',
      password: 'short',
      firstName: '',
      lastName: '',
    });
    expect(errs.email).toBeDefined();
    expect(errs.password).toBeDefined();
    expect(errs.firstName).toBeDefined();
    expect(errs.lastName).toBeDefined();
  });
});
