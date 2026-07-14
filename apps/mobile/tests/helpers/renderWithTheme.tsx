import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { ThemePreference } from '../../src/auth/secure-store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0, staleTime: 0 },
    mutations: { retry: false },
  },
});

export function renderWithTheme(ui: ReactElement, themeName: Exclude<ThemePreference, 'system'>) {
  return render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider initial={themeName}>{ui}</ThemeProvider>
    </QueryClientProvider>,
  );
}
