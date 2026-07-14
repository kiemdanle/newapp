import { renderWithTheme } from '../helpers/renderWithTheme';
import Reviews from '../../app/(app)/(tabs)/reviews';

describe.each(['expyrico', 'expyricoDark'] as const)('reviews in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Reviews />, theme).toJSON()).toMatchSnapshot();
  });
});
