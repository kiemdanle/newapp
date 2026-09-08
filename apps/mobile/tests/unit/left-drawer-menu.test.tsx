import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { LeftDrawerMenu } from '../../src/navigation/LeftDrawerMenu';
import { useDrawerStore } from '../../src/store/drawerStore';
import { useSessionStore } from '../../src/auth/session-store';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 30, left: 0, right: 0 }),
}));

jest.mock('../../src/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bg: '#FAFAF8',
      bgElevated: '#FAFAF8',
      text: '#2C2C28',
      textMuted: '#8C8C85',
      border: '#F0F0ED',
      primary: '#4BAE8A',
      primaryDark: '#3A8F6F',
      primaryLight: '#D6F0E6',
      danger: '#E0442A',
    },
    radii: { md: 8, lg: 12 },
  }),
}));

describe('LeftDrawerMenu Component', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    act(() => {
      useDrawerStore.getState().reset();
      useSessionStore.setState({
        user: {
          id: 'u1',
          email: 'jane@example.com',
          firstName: 'Jane',
          lastName: 'Doe',
          role: 'user',
        } as any,
      });
    });
  });

  it('renders brand header, close button, and user info', () => {
    const { getByText, getByTestId } = render(<LeftDrawerMenu />);

    expect(getByText('Zero Food Waste')).toBeTruthy();
    expect(getByTestId('drawer-close-button')).toBeTruthy();
    expect(getByText('Jane Doe')).toBeTruthy();
    expect(getByText('jane@example.com')).toBeTruthy();
  });
  it('wraps content in a vertical ScrollView for compact devices', () => {
    const { getByTestId } = render(<LeftDrawerMenu />);
    expect(getByTestId('left-drawer-scroll-view')).toBeTruthy();
  });


  it('renders all 5 primary navigation tabs with testIDs', () => {
    const { getByTestId } = render(<LeftDrawerMenu />);

    expect(getByTestId('nav-Home')).toBeTruthy();
    expect(getByTestId('nav-Giveaways')).toBeTruthy();
    expect(getByTestId('nav-Deals')).toBeTruthy();
    expect(getByTestId('nav-Reviews')).toBeTruthy();
    expect(getByTestId('nav-Profile')).toBeTruthy();
  });

  it('tapping a tab closes drawer and navigates to nested tab screen', () => {
    act(() => {
      useDrawerStore.getState().openDrawer();
    });

    const { getByTestId } = render(<LeftDrawerMenu />);

    act(() => {
      fireEvent.press(getByTestId('nav-Deals'));
    });

    expect(useDrawerStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('Tabs', { screen: 'Deals' });
  });

  it('tapping user card closes drawer and navigates to ProfileEdit', () => {
    act(() => {
      useDrawerStore.getState().openDrawer();
    });

    const { getByTestId } = render(<LeftDrawerMenu />);

    act(() => {
      fireEvent.press(getByTestId('drawer-user-card'));
    });

    expect(useDrawerStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('ProfileEdit');
  });

  it('tapping close button calls closeDrawer', () => {
    act(() => {
      useDrawerStore.getState().openDrawer();
    });

    const { getByTestId } = render(<LeftDrawerMenu />);

    act(() => {
      fireEvent.press(getByTestId('drawer-close-button'));
    });

    expect(useDrawerStore.getState().isOpen).toBe(false);
  });

  it('secondary shortcuts close drawer before navigating', () => {
    const { getByTestId } = render(<LeftDrawerMenu />);

    // Scan
    act(() => {
      useDrawerStore.getState().openDrawer();
      fireEvent.press(getByTestId('shortcut-scan'));
    });
    expect(useDrawerStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('Scan');

    // Household
    act(() => {
      useDrawerStore.getState().openDrawer();
      fireEvent.press(getByTestId('shortcut-household'));
    });
    expect(useDrawerStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('Household');

    // Settings
    act(() => {
      useDrawerStore.getState().openDrawer();
      fireEvent.press(getByTestId('shortcut-settings'));
    });
    expect(useDrawerStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('SettingsIndex');

    // Feedback
    act(() => {
      useDrawerStore.getState().openDrawer();
      fireEvent.press(getByTestId('shortcut-feedback'));
    });
    expect(useDrawerStore.getState().isOpen).toBe(false);
    expect(mockNavigate).toHaveBeenCalledWith('FeedbackHub');
  });

  it('tapping sign out shows confirmation alert', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { getByTestId } = render(<LeftDrawerMenu />);

    act(() => {
      fireEvent.press(getByTestId('drawer-sign-out'));
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Sign Out',
      'Are you sure you want to sign out of Expyrico?',
      expect.any(Array)
    );

    alertSpy.mockRestore();
  });
});
