import { renderWithTheme } from '../helpers/renderWithTheme';
import Product from '../../app/(app)/product/[id]';

describe.each(['expyrico', 'expyricoDark'] as const)('product detail in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Product />, theme).toJSON()).toMatchSnapshot();
  });
});
