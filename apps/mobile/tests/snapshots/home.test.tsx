import { renderWithTheme } from '../helpers/renderWithTheme';
import Home from '../../app/(app)/(tabs)/home';

describe.each(['expyrico', 'expyricoDark'] as const)('home in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Home />, theme).toJSON()).toMatchSnapshot();
  });
});
