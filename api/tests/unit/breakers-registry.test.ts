import { describe, expect, it } from 'vitest';
import CircuitBreaker from 'opossum';
import {
  register,
  getBreaker,
  getAllBreakers,
} from '../../src/services/external/breakers.js';

function freshBreaker(name: string) {
  return new CircuitBreaker(async () => name, { timeout: 100, name });
}

describe('breakers registry', () => {
  it('register + getBreaker round-trip', () => {
    const b = freshBreaker('alpha');
    register('alpha', b);
    expect(getBreaker('alpha')).toBe(b);
  });

  it('getBreaker throws when name missing', () => {
    expect(() => getBreaker('not-registered-xyz')).toThrow(/not registered/i);
  });

  it('getAllBreakers lists every registered breaker', () => {
    const b1 = freshBreaker('beta');
    const b2 = freshBreaker('gamma');
    register('beta', b1);
    register('gamma', b2);
    const names = getAllBreakers().map((x) => x.name);
    expect(names).toEqual(expect.arrayContaining(['beta', 'gamma']));
  });
});
