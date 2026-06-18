import { renderWithTheme } from '../helpers/renderWithTheme';
import Settings from '../../app/(app)/settings/index';

describe.each(['expyrico', 'bento', 'clay', 'material'] as const)('settings in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Settings />, theme).toJSON()).toMatchSnapshot();
  });
});
