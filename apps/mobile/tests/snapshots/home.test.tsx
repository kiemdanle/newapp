import { renderWithTheme } from '../helpers/renderWithTheme';
import Home from '../../app/(app)/(tabs)/home';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

jest.mock('react-native-safe-area-context', () => ({
  ...jest.requireActual('react-native-safe-area-context'),
  useSafeAreaInsets: jest.fn(() => ({ top: 0, right: 0, bottom: 0, left: 0 })),
}));

const mockUseSafeAreaInsets = useSafeAreaInsets as jest.Mock;

describe.each(['expyrico', 'expyricoDark'] as const)('home in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Home />, theme).toJSON()).toMatchSnapshot();
  });

  it('offers an icon-led primary scan action when the pantry is empty', () => {
    const screen = renderWithTheme(<Home />, theme);

    expect(screen.getByLabelText('Scan pantry items')).toBeTruthy();
    expect(screen.getByText('Start your pantry')).toBeTruthy();
    expect(screen.getByTestId('home-scan-action')).toBeTruthy();
    expect(screen.getAllByLabelText('Scan pantry items')).toHaveLength(1);
  });

  it('keeps the pantry list scrollable', () => {
    const screen = renderWithTheme(<Home />, theme);

    expect(screen.getByTestId('pantry-record-list').props.scrollEnabled).toBe(true);
  });

  it('keeps the scan action above the tab bar at the default safe-area inset', () => {
    const screen = renderWithTheme(<Home />, theme);

    expect(screen.getByTestId('home-scan-action').props.style[1].bottom).toBe(88);
  });

  it('adds bottom safe-area clearance for gesture navigation', () => {
    mockUseSafeAreaInsets.mockReturnValueOnce({ top: 0, right: 0, bottom: 34, left: 0 });
    const screen = renderWithTheme(<Home />, theme);

    expect(screen.getByTestId('home-scan-action').props.style[1].bottom).toBe(122);
  });
});
