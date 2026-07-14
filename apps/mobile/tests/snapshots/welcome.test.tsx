import { renderWithTheme } from '../helpers/renderWithTheme';
import Welcome from '../../app/(auth)/welcome';
import * as ReactNative from 'react-native';

describe.each(['expyrico', 'expyricoDark'] as const)('welcome in %s', (theme) => {
  it('snapshot', () => {
    expect(renderWithTheme(<Welcome />, theme).toJSON()).toMatchSnapshot();
  });
});

it('keeps the welcome lockup within a narrow 320dp viewport', () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
    width: 320,
    height: 640,
    scale: 1,
    fontScale: 1,
  });

  const screen = renderWithTheme(<Welcome />, 'expyrico');
  const lockup = screen.getByTestId('auth-brand-lockup');
  expect(lockup.props.style).toEqual(expect.objectContaining({ maxWidth: 272 }));
  expect(screen.getByTestId('welcome-sign-up')).toBeTruthy();
  expect(screen.getByTestId('welcome-sign-in')).toBeTruthy();
  jest.restoreAllMocks();
});
