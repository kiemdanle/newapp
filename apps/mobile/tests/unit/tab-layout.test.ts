import { isCompactTabLayout } from '../../src/navigation/TabsNavigator';

describe('isCompactTabLayout', () => {
  it('uses icon-only tabs at 320dp to keep all six actions reachable', () => {
    expect(isCompactTabLayout(320)).toBe(true);
  });

  it('keeps the active label on wider phones', () => {
    expect(isCompactTabLayout(390)).toBe(false);
  });
});
