import { renderWithTheme } from '../helpers/renderWithTheme';
import Browse from '../../app/(app)/(tabs)/browse';

describe.each(['expyrico', 'bento', 'clay', 'material'] as const)('browse in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Browse />, theme).toJSON()).toMatchSnapshot();
  });
});
