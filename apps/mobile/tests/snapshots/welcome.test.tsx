import { renderWithTheme } from '../helpers/renderWithTheme';
import Welcome from '../../app/(auth)/welcome';

describe.each(['expyrico', 'expyricoDark'] as const)('welcome in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Welcome />, theme).toJSON()).toMatchSnapshot();
  });
});
