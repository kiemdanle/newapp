import { renderWithTheme } from '../helpers/renderWithTheme';
import Home from '../../app/(app)/(tabs)/home';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));


describe.each(['expyrico', 'expyricoDark'] as const)('home in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Home />, theme).toJSON()).toMatchSnapshot();
  });

  it('renders pantry start state when empty', () => {
    const screen = renderWithTheme(<Home />, theme);

    expect(screen.getByText('Start your pantry')).toBeTruthy();
    expect(screen.getByText('Pantry')).toBeTruthy();
  });

  it('keeps the pantry list scrollable', () => {
    const screen = renderWithTheme(<Home />, theme);

    expect(screen.getByTestId('pantry-record-list').props.scrollEnabled).toBe(true);
  });
});
