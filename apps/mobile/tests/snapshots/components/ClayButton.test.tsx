import { renderWithTheme } from '../../helpers/renderWithTheme';
import { ClayButton } from '../../../src/components/ClayButton';

describe('ClayButton', () => {
  it.each(['expyrico', 'expyricoDark'] as const)('renders in %s', (theme) => {
    expect(renderWithTheme(
      <ClayButton title="Save" onPress={() => {}} />, theme,
    ).toJSON()).toMatchSnapshot();
  });
});
