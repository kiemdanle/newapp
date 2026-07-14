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

it('keeps both welcome actions as normal 52dp controls without a full-height child', () => {
  const screen = renderWithTheme(<Welcome />, 'expyrico');

  const signUp = screen.getByTestId('welcome-sign-up');
  const signIn = screen.getByTestId('welcome-sign-in');

  expect(signUp.props.style[0]).toEqual(expect.objectContaining({ height: 52, minHeight: 52 }));
  expect(signIn.props.style[0]).toEqual(expect.objectContaining({ height: 52, minHeight: 52 }));
  expect(signUp.children[0].props.style).not.toEqual(expect.objectContaining({ height: '100%' }));
  expect(signIn.children[0].props.style).not.toEqual(expect.objectContaining({ height: '100%' }));
  expect(signIn).toBeTruthy();
});
