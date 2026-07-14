import { renderWithTheme } from '../../helpers/renderWithTheme';
import { ClayCard } from '../../../src/components/ClayCard';
import { Text } from 'react-native';

describe('ClayCard', () => {
  it.each(['expyrico', 'expyricoDark'] as const)('renders in %s', (theme) => {
    const tree = renderWithTheme(
      <ClayCard><Text>Hello</Text></ClayCard>, theme,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
