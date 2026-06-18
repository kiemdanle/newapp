import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import type { ReactElement } from 'react';

export function renderWithTheme(ui: ReactElement, themeName: 'expyrico' | 'bento' | 'clay' | 'material') {
  return render(<ThemeProvider initial={themeName}>{ui}</ThemeProvider>);
}
