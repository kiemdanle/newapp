import React from 'react';
import { Text, ScrollView, View, KeyboardAvoidingView, Platform } from 'react-native';
import { render } from '@testing-library/react-native';
import { Screen } from '../../src/components/Screen';
import { KeyboardAwareScrollView } from '../../src/components/KeyboardAwareScrollView';

type ViewInstance = { props: { onFocusCapture?: (event: unknown) => void; [key: string]: unknown } };

describe('Screen component keyboard handling & layout primitives', () => {
  it('renders KeyboardAwareScrollView with focus capture and keyboard props when scroll=true', () => {
    const { UNSAFE_getByType, getByText } = render(
      <Screen scroll={true}>
        <Text>Test Form Content</Text>
      </Screen>,
    );

    expect(getByText('Test Form Content')).toBeTruthy();

    const awareScroll = UNSAFE_getByType(KeyboardAwareScrollView);
    expect(awareScroll).toBeTruthy();
    const scrollView = UNSAFE_getByType(ScrollView);
    expect(scrollView.props.keyboardShouldPersistTaps).toBe('handled');
    expect(scrollView.props.keyboardDismissMode).toBe('on-drag');

    // Verify onFocusCapture is attached to the wrapping View
    const views = UNSAFE_getByType(KeyboardAwareScrollView).findAllByType(View) as unknown as ViewInstance[];
    const focusView = views.find((v: ViewInstance) => typeof v.props.onFocusCapture === 'function');
    expect(focusView).toBeDefined();
    expect(typeof focusView?.props.onFocusCapture).toBe('function');
  });
  it('renders View instead of ScrollView when scroll=false', () => {
    const { UNSAFE_queryByType, getByText } = render(
      <Screen scroll={false}>
        <Text>Fixed Screen Content</Text>
      </Screen>,
    );

    expect(getByText('Fixed Screen Content')).toBeTruthy();
    expect(UNSAFE_queryByType(ScrollView)).toBeNull();
    expect(UNSAFE_queryByType(KeyboardAwareScrollView)).toBeNull();
  });

  it('passes keyboardAvoiding flag to KeyboardAwareScrollView', () => {
    const { UNSAFE_getByType } = render(
      <Screen scroll={true} keyboardAvoiding={false}>
        <Text>Escape Hatch Content</Text>
      </Screen>,
    );

    const awareScroll = UNSAFE_getByType(KeyboardAwareScrollView);
    expect(awareScroll.props.keyboardAvoiding).toBe(false);
  });

  it('calls scrollResponderScrollNativeHandleToKeyboard with default platform offset on focus', () => {
    jest.useFakeTimers();
    try {
      const scrollRef = React.createRef<ScrollView>();
      const { UNSAFE_getByType } = render(
        <KeyboardAwareScrollView ref={scrollRef}>
          <Text>Content</Text>
        </KeyboardAwareScrollView>,
      );

      const scrollView = scrollRef.current;
      expect(scrollView).toBeTruthy();
      const scrollSpy = jest.fn();
      const mockResponder = scrollView as unknown as {
        scrollResponderScrollNativeHandleToKeyboard?: jest.Mock;
      };
      mockResponder.scrollResponderScrollNativeHandleToKeyboard = scrollSpy;

      const views = UNSAFE_getByType(KeyboardAwareScrollView).findAllByType(View) as unknown as ViewInstance[];
      const focusView = views.find((v: ViewInstance) => typeof v.props.onFocusCapture === 'function');
      expect(focusView).toBeDefined();
      focusView?.props.onFocusCapture?.({ nativeEvent: { target: 101 } });

      jest.advanceTimersByTime(100);

      const expectedOffset = Platform.OS === 'android' ? 160 : 48;
      expect(scrollSpy).toHaveBeenCalledWith(101, expectedOffset, true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('calls scrollResponderScrollNativeHandleToKeyboard with custom extraKeyboardOffset', () => {
    jest.useFakeTimers();
    try {
      const scrollRef = React.createRef<ScrollView>();
      const { UNSAFE_getByType } = render(
        <KeyboardAwareScrollView ref={scrollRef} extraKeyboardOffset={220}>
          <Text>Content</Text>
        </KeyboardAwareScrollView>,
      );

      const scrollView = scrollRef.current;
      expect(scrollView).toBeTruthy();
      const scrollSpy = jest.fn();
      const mockResponder = scrollView as unknown as {
        scrollResponderScrollNativeHandleToKeyboard?: jest.Mock;
      };
      mockResponder.scrollResponderScrollNativeHandleToKeyboard = scrollSpy;

      const views = UNSAFE_getByType(KeyboardAwareScrollView).findAllByType(View) as unknown as ViewInstance[];
      const focusView = views.find((v: ViewInstance) => typeof v.props.onFocusCapture === 'function');
      expect(focusView).toBeDefined();
      focusView?.props.onFocusCapture?.({ nativeEvent: { target: 202 } });
      jest.advanceTimersByTime(100);

      expect(scrollSpy).toHaveBeenCalledWith(202, 220, true);
    } finally {
      jest.useRealTimers();
    }
  });
});
