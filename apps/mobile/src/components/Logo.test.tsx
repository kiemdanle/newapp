import { LOGO_COLORS } from './Logo';

describe('Logo palette', () => {
  it('uses only the approved brand colours and never Alert Red', () => {
    expect(LOGO_COLORS).toEqual({ sage: '#4BAE8A', honey: '#F5A623', needle: '#2C2C28' });
  });
});
