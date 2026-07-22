import { renderWithTheme } from '../helpers/renderWithTheme';
import Product from '../../app/(app)/product/[id]';

const mockedNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockedNavigate,
    goBack: jest.fn(),
  }),
  useRoute: () => ({ params: { id: 'prod-1' } }),
}));

describe.each(['expyrico', 'expyricoDark'] as const)('product detail in %s', (theme) => {
  it('snapshot', () => {
    expect(
      renderWithTheme(
        <Product />,
        theme,
      ).toJSON(),
    ).toMatchSnapshot();
  });
});
