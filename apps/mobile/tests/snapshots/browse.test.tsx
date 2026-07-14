import { renderWithTheme } from '../helpers/renderWithTheme';
import Browse from '../../app/(app)/(tabs)/browse';

describe.each(['expyrico', 'expyricoDark'] as const)('browse in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Browse />, theme).toJSON()).toMatchSnapshot();
  });
});
