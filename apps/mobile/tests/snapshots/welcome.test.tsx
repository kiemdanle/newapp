import { renderWithTheme } from '../helpers/renderWithTheme';
import Welcome from '../../app/(auth)/welcome';

describe.each(['expyrico', 'bento', 'clay', 'material'] as const)('welcome in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Welcome />, theme).toJSON()).toMatchSnapshot();
  });
});
