import { renderWithTheme } from '../helpers/renderWithTheme';
import Home from '../../app/(app)/(tabs)/home';

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
});
