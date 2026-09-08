import React from 'react';
import { BackHandler, Text } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SlidingDrawer } from '../../src/components/SlidingDrawer';
import { useDrawerStore } from '../../src/store/drawerStore';
import { useSelectionModeStore } from '../../src/store/selectionModeStore';

let mockIsFocused = true;
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockIsFocused,
}));

jest.mock('../../src/theme/useTheme', () => ({
  useTheme: () => ({
    colors: {
      bgElevated: '#FAFAF8',
      bg: '#FAFAF8',
      text: '#2C2C28',
    },
  }),
}));

describe('useDrawerStore', () => {
  beforeEach(() => {
    act(() => {
      useDrawerStore.getState().reset();
    });
  });

  it('initializes with isOpen false and activeTab Home', () => {
    const state = useDrawerStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.activeTab).toBe('Home');
  });

  it('updates isOpen on openDrawer, closeDrawer, and toggleDrawer', () => {
    act(() => {
      useDrawerStore.getState().openDrawer();
    });
    expect(useDrawerStore.getState().isOpen).toBe(true);

    act(() => {
      useDrawerStore.getState().closeDrawer();
    });
    expect(useDrawerStore.getState().isOpen).toBe(false);

    act(() => {
      useDrawerStore.getState().toggleDrawer();
    });
    expect(useDrawerStore.getState().isOpen).toBe(true);

    act(() => {
      useDrawerStore.getState().toggleDrawer();
    });
    expect(useDrawerStore.getState().isOpen).toBe(false);
  });

  it('updates activeTab and resets state correctly', () => {
    act(() => {
      useDrawerStore.getState().setActiveTab('Deals');
      useDrawerStore.getState().openDrawer();
    });
    expect(useDrawerStore.getState().activeTab).toBe('Deals');
    expect(useDrawerStore.getState().isOpen).toBe(true);

    act(() => {
      useDrawerStore.getState().reset();
    });
    expect(useDrawerStore.getState().activeTab).toBe('Home');
    expect(useDrawerStore.getState().isOpen).toBe(false);
  });
});

describe('SlidingDrawer Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockIsFocused = true;
    act(() => {
      useDrawerStore.getState().reset();
      useSelectionModeStore.setState({ isSelectionMode: false });
    });
  });

  afterEach(() => {
    act(() => {
      jest.runAllTimers();
    });
    jest.useRealTimers();
  });

  it('renders drawerContent and children in closed state', () => {
    const { getByText, getByTestId, queryByTestId } = render(
      <SlidingDrawer
        drawerContent={<Text>Drawer Menu Content</Text>}
      >
        <Text>Main Screen Content</Text>
      </SlidingDrawer>
    );

    expect(getByText('Drawer Menu Content', { includeHiddenElements: true })).toBeTruthy();
    expect(getByText('Main Screen Content')).toBeTruthy();

    const drawerContentContainer = getByTestId('sliding-drawer-content', {
      includeHiddenElements: true,
    });
    expect(drawerContentContainer.props.pointerEvents).toBe('none');
    expect(drawerContentContainer.props.accessibilityElementsHidden).toBe(true);

    const childrenWrapper = getByTestId('sliding-drawer-children-wrapper');
    expect(childrenWrapper.props.pointerEvents).toBe('auto');
    expect(childrenWrapper.props.accessibilityElementsHidden).toBe(false);
    expect(childrenWrapper.props.importantForAccessibility).toBe('yes');
    expect(getByTestId('sliding-drawer-root')).toBeTruthy();
    // Backdrop is not open
    expect(queryByTestId('drawer-backdrop')).toBeNull();
  });

  it('renders backdrop and sets pointerEvents when open', () => {
    act(() => {
      useDrawerStore.getState().openDrawer();
    });

    const { getByTestId } = render(
      <SlidingDrawer
        drawerContent={<Text>Drawer Menu Content</Text>}
      >
        <Text>Main Screen Content</Text>
      </SlidingDrawer>
    );

    const drawerContentContainer = getByTestId('sliding-drawer-content');
    expect(drawerContentContainer.props.pointerEvents).toBe('auto');
    expect(drawerContentContainer.props.accessibilityElementsHidden).toBe(false);

    const childrenWrapper = getByTestId('sliding-drawer-children-wrapper', {
      includeHiddenElements: true,
    });
    expect(childrenWrapper.props.pointerEvents).toBe('none');
    expect(childrenWrapper.props.accessibilityElementsHidden).toBe(true);
    expect(childrenWrapper.props.importantForAccessibility).toBe('no-hide-descendants');

    // Backdrop is rendered
    expect(getByTestId('drawer-backdrop')).toBeTruthy();
  });

  it('tapping backdrop calls closeDrawer', () => {
    act(() => {
      useDrawerStore.getState().openDrawer();
    });

    const { getByLabelText } = render(
      <SlidingDrawer
        drawerContent={<Text>Drawer Menu Content</Text>}
      >
        <Text>Main Screen Content</Text>
      </SlidingDrawer>
    );

    const backdropButton = getByLabelText('Dismiss menu backdrop');
    act(() => {
      fireEvent.press(backdropButton);
    });

    expect(useDrawerStore.getState().isOpen).toBe(false);
  });

  it('closes drawer automatically if selection mode activates', () => {
    act(() => {
      useDrawerStore.getState().openDrawer();
    });
    expect(useDrawerStore.getState().isOpen).toBe(true);

    render(
      <SlidingDrawer
        drawerContent={<Text>Drawer Menu Content</Text>}
      >
        <Text>Main Screen Content</Text>
      </SlidingDrawer>
    );

    act(() => {
      useSelectionModeStore.setState({ isSelectionMode: true });
    });

    expect(useDrawerStore.getState().isOpen).toBe(false);
  });

  it('handles hardware back button only when open and focused', () => {
    const backHandlerSpy = jest.spyOn(BackHandler, 'addEventListener');

    render(
      <SlidingDrawer
        drawerContent={<Text>Drawer Menu Content</Text>}
      >
        <Text>Main Screen Content</Text>
      </SlidingDrawer>
    );

    act(() => {
      useDrawerStore.getState().openDrawer();
    });

    let registeredHandler: (() => boolean) | undefined;
    for (const call of backHandlerSpy.mock.calls) {
      if (call[0] === 'hardwareBackPress') {
        registeredHandler = call[1] as () => boolean;
      }
    }

    expect(registeredHandler).toBeDefined();

    act(() => {
      const consumed = registeredHandler?.();
      expect(consumed).toBe(true);
    });
    expect(useDrawerStore.getState().isOpen).toBe(false);

    backHandlerSpy.mockRestore();
  });

  it('does not register hardware back press if screen is not focused', () => {
    mockIsFocused = false;
    act(() => {
      useDrawerStore.getState().openDrawer();
    });

    const backHandlerSpy = jest.spyOn(BackHandler, 'addEventListener');

    render(
      <SlidingDrawer
        drawerContent={<Text>Drawer Menu Content</Text>}
      >
        <Text>Main Screen Content</Text>
      </SlidingDrawer>
    );

    expect(backHandlerSpy).not.toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function)
    );

    backHandlerSpy.mockRestore();
  });
});
