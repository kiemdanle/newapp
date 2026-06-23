import { renderWithTheme } from '../helpers/renderWithTheme';
import Reviews from '../../app/(app)/(tabs)/reviews';

describe.each(['expyrico', 'bento', 'clay', 'material'] as const)('reviews in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Reviews />, theme).toJSON()).toMatchSnapshot();
  });
});
