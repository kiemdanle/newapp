import { renderWithTheme } from '../helpers/renderWithTheme';
import SignIn from '../../app/(auth)/sign-in';

describe.each(['expyrico', 'bento', 'clay', 'material'] as const)('sign-in in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<SignIn />, theme).toJSON()).toMatchSnapshot();
  });
});
