import { describe, it, expect, beforeEach } from '@jest/globals';
import { renderHook, act } from '@testing-library/react-native';
import { useCountryFormat } from './useCountryFormat';
import { useSessionStore } from '../auth/session-store';
import type { User } from '@expyrico/shared';

describe('useCountryFormat hook', () => {
  const baseUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    email: 'user@example.com',
    emailVerified: true,
    firstName: 'Dan',
    lastName: 'Le',
    address: '123 Main St',
    country: 'US',
    avatarUrl: null,
    hasPassword: true,
    role: 'user',
    status: 'active',
    themePreference: 'expyrico',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    useSessionStore.setState({ user: { ...baseUser, country: 'US' } });
  });

  it('reactively updates currency and date formatting when user country changes', () => {
    const { result } = renderHook(() => useCountryFormat());

    expect(result.current.activeCountry).toBe('US');
    expect(result.current.currencySymbol).toBe('$');

    // Update user country in session store to Vietnam
    act(() => {
      useSessionStore.setState({ user: { ...baseUser, country: 'VN' } });
    });

    expect(result.current.activeCountry).toBe('VN');
    expect(result.current.currencySymbol).toBe('₫');
    expect(result.current.formatCurrency(100000)).toBe('100.000 ₫');
  });
});
