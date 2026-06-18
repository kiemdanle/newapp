import { renderWithTheme } from '../../helpers/renderWithTheme';
import { BentoTile } from '../../../src/components/BentoTile';

describe('BentoTile', () => {
  it.each(['expyrico', 'bento', 'clay', 'material'] as const)('renders in %s theme', (theme) => {
    const tree = renderWithTheme(
      <BentoTile size="md" accent={false} title="Milk" subtitle="Expires Fri" />,
      theme,
    ).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
