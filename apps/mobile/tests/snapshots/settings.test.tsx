import { renderWithTheme } from '../helpers/renderWithTheme';
import Settings from '../../app/(app)/settings/index';

describe.each(['expyrico', 'expyricoDark'] as const)('settings in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Settings />, theme).toJSON()).toMatchSnapshot();
  });
});
