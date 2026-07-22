import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../../src/theme/ThemeProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import type { ThemePreference } from '../../src/auth/secure-store';

export function renderWithTheme(ui: ReactElement, themeName: Exclude<ThemePreference, 'system'>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return render(
    <NavigationContainer>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider initial={themeName}>{ui}</ThemeProvider>
      </QueryClientProvider>
    </NavigationContainer>,
  );
}
