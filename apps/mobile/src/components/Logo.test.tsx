import { LOGO_COLORS } from './Logo';

describe('Logo palette', () => {
  it('matches the official three-segment gauge (sage / honey / alert red) plus needle', () => {
    // Alert Red is the expired segment of the brand mark itself (semantic),
    // not decorative chrome — see docs/design-guidelines status colors.
    expect(LOGO_COLORS).toEqual({
      sage: '#4BAE8A',
      honey: '#F5A623',
      alertRed: '#E0442A',
      needle: '#2C2C28',
    });
  });
});
