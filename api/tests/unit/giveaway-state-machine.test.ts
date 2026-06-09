import { describe, expect, it } from 'vitest';
import { canTransition, assertTransition } from '../../src/services/giveaways/state-machine.js';

describe('giveaway state machine', () => {
  it('allows open → claimed', () => expect(canTransition('open', 'claimed')).toBe(true));
  it('allows claimed → handed_off', () => expect(canTransition('claimed', 'handed_off')).toBe(true));
  it('allows handed_off → completed', () => expect(canTransition('handed_off', 'completed')).toBe(true));
  it('allows claimed → open (auto-expiry)', () => expect(canTransition('claimed', 'open')).toBe(true));
  it('allows cancel from open/claimed/handed_off', () => {
    expect(canTransition('open', 'cancelled')).toBe(true);
    expect(canTransition('claimed', 'cancelled')).toBe(true);
    expect(canTransition('handed_off', 'cancelled')).toBe(true);
  });
  it('forbids completing without handed_off', () => {
    expect(canTransition('open', 'completed')).toBe(false);
    expect(canTransition('claimed', 'completed')).toBe(false);
  });
  it('forbids transitions from terminal states', () => {
    expect(canTransition('completed', 'cancelled')).toBe(false);
    expect(canTransition('cancelled', 'open')).toBe(false);
  });
  it('assertTransition throws on illegal move', () => {
    expect(() => assertTransition('claimed', 'completed')).toThrow();
  });
});
