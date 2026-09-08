import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { HamburgerButton } from '../../src/components/HamburgerButton';
import { useDrawerStore } from '../../src/store/drawerStore';

jest.mock('../../src/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      text: '#2C2C28',
    },
  }),
}));

describe('HamburgerButton Component', () => {
  beforeEach(() => {
    act(() => {
      useDrawerStore.getState().reset();
    });
  });

  it('renders with default testID, icon, and accessibility attributes in closed state', () => {
    const { getByTestId } = render(<HamburgerButton />);

    const button = getByTestId('top-nav-menu-button');
    expect(button).toBeTruthy();
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('Open navigation menu');
    expect(button.props.accessibilityState).toEqual({ expanded: false });
  });

  it('reflects expanded state and updated label when drawer is open', () => {
    act(() => {
      useDrawerStore.getState().openDrawer();
    });

    const { getByTestId } = render(<HamburgerButton />);

    const button = getByTestId('top-nav-menu-button');
    expect(button.props.accessibilityLabel).toBe('Close navigation menu');
    expect(button.props.accessibilityState).toEqual({ expanded: true });
  });

  it('toggles drawer state on press', () => {
    const { getByTestId } = render(<HamburgerButton />);

    expect(useDrawerStore.getState().isOpen).toBe(false);

    act(() => {
      fireEvent.press(getByTestId('top-nav-menu-button'));
    });

    expect(useDrawerStore.getState().isOpen).toBe(true);

    act(() => {
      fireEvent.press(getByTestId('top-nav-menu-button'));
    });

    expect(useDrawerStore.getState().isOpen).toBe(false);
  });

  it('accepts custom testID and custom style', () => {
    const { getByTestId } = render(
      <HamburgerButton testID="custom-menu-btn" style={{ marginLeft: 8 }} />
    );

    expect(getByTestId('custom-menu-btn')).toBeTruthy();
  });
});
