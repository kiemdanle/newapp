import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  },
});

export function renderWithTheme(ui: ReactElement, themeName: 'expyrico' | 'bento' | 'clay' | 'material') {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initial={themeName}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}
