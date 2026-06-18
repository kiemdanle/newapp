import { renderWithTheme } from '../helpers/renderWithTheme';
import ThemeSettings from '../../app/(app)/settings/theme';

describe.each(['expyrico', 'bento', 'clay', 'material'] as const)('theme settings in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<ThemeSettings />, theme).toJSON()).toMatchSnapshot();
  });
});
