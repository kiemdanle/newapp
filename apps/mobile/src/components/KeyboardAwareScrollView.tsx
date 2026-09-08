import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import {
  Dimensions,
  ScrollView,
  View,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StyleSheet,
  TextInput,
  findNodeHandle,
  type ScrollViewProps,
  type ViewProps,
  type NativeSyntheticEvent,
  type TargetedEvent,
  type KeyboardEvent,
} from 'react-native';
export interface KeyboardAwareScrollContextValue {
  scrollToInput: (targetOrRef: unknown, extraOffset?: number) => void;
  keyboardHeight: number;
}

export const KeyboardAwareScrollContext =
  React.createContext<KeyboardAwareScrollContextValue | null>(null);

export function useKeyboardAwareScroll() {
  return React.useContext(KeyboardAwareScrollContext);
}

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  extraKeyboardOffset?: number;
  keyboardAvoiding?: boolean;
}

interface FocusableViewProps {
  style?: ViewProps['style'];
  children?: React.ReactNode;
  onFocusCapture?: (e: NativeSyntheticEvent<TargetedEvent>) => void;
}

const FocusableView = View as unknown as React.ComponentType<FocusableViewProps>;
const DEFAULT_EXTRA_KEYBOARD_OFFSET = Platform.OS === 'android' ? 160 : 48;

export const KeyboardAwareScrollView = forwardRef<ScrollView, KeyboardAwareScrollViewProps>(
  function KeyboardAwareScrollView(
    {
      children,
      style,
      contentContainerStyle,
      extraKeyboardOffset = DEFAULT_EXTRA_KEYBOARD_OFFSET,
      keyboardAvoiding = true,
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'on-drag',
      automaticallyAdjustKeyboardInsets = Platform.OS === 'ios',
      ...rest
    },
    ref,
  ) {
    const internalScrollRef = useRef<ScrollView>(null);
    useImperativeHandle(ref, () => internalScrollRef.current as ScrollView);

    const [keyboardHeight, setKeyboardHeight] = useState(0);
    const keyboardHeightRef = useRef(0);
    const lastFocusedTargetRef = useRef<number | null>(null);

    const scrollTargetIntoView = useCallback(
      (target: number | null, delay = 60, offset = extraKeyboardOffset) => {
        if (!target) return;
        setTimeout(() => {
          const scrollResponder = internalScrollRef.current as (ScrollView & {
            scrollResponderScrollNativeHandleToKeyboard?: (
              target: number,
              offset: number,
              preventNegative: boolean,
            ) => void;
            _keyboardMetrics?: { screenY: number; height: number };
          }) | null;
          if (scrollResponder) {
            // React Native's built-in ScrollView on Android never populates _keyboardMetrics
            // (it only listens to iOS keyboardWillShow). Inject the real keyboard metrics here
            // so scrollResponderScrollNativeHandleToKeyboard computes the exact target scroll offset!
            if (keyboardHeightRef.current > 0) {
              const windowHeight = Dimensions.get('window').height;
              scrollResponder._keyboardMetrics = {
                screenY: windowHeight - keyboardHeightRef.current,
                height: keyboardHeightRef.current,
              };
            }
            if (
              typeof scrollResponder.scrollResponderScrollNativeHandleToKeyboard ===
              'function'
            ) {
              scrollResponder.scrollResponderScrollNativeHandleToKeyboard(
                target,
                offset,
                true,
              );
            }
          }
        }, delay);
      },
      [extraKeyboardOffset],
    );

    const scrollToInput = useCallback(
      (targetOrRef: unknown, offset = extraKeyboardOffset) => {
        if (!targetOrRef) return;
        const target =
          typeof targetOrRef === 'number'
            ? targetOrRef
            : (findNodeHandle(targetOrRef as Parameters<typeof findNodeHandle>[0]) ?? null);
        if (target) {
          lastFocusedTargetRef.current = target;
          scrollTargetIntoView(target, 60, offset);
        }
      },
      [extraKeyboardOffset, scrollTargetIntoView],
    );

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const onShow = (e: KeyboardEvent) => {
        const height = e?.endCoordinates?.height ?? 0;
        keyboardHeightRef.current = height;
        setKeyboardHeight(height);
        if (lastFocusedTargetRef.current) {
          scrollTargetIntoView(lastFocusedTargetRef.current, 50);
        } else {
          const field = TextInput.State?.currentlyFocusedField?.();
          if (typeof field === 'number') {
            scrollToInput(field);
          } else {
            const input = TextInput.State?.currentlyFocusedInput?.();
            if (input) {
              scrollToInput(input);
            }
          }
        }
      };

      const onHide = () => {
        keyboardHeightRef.current = 0;
        setKeyboardHeight(0);
        lastFocusedTargetRef.current = null;
      };

      const showSub = Keyboard.addListener(showEvent, onShow);
      const hideSub = Keyboard.addListener(hideEvent, onHide);

      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [scrollTargetIntoView, scrollToInput]);

    const contextValue = React.useMemo(
      () => ({
        scrollToInput,
        keyboardHeight,
      }),
      [scrollToInput, keyboardHeight],
    );

    const handleFocusCapture = useCallback(
      (e: NativeSyntheticEvent<TargetedEvent>) => {
        const eventNative = e.nativeEvent as unknown;
        let rawTarget: unknown = null;
        if (eventNative && typeof eventNative === 'object' && 'target' in eventNative) {
          const targetProp = (eventNative as { target: unknown }).target;
          rawTarget = targetProp;
        } else if (e && typeof e === 'object' && 'target' in e) {
          const targetProp = (e as unknown as { target: unknown }).target;
          rawTarget = targetProp;
        }
        const target =
          typeof rawTarget === 'number'
            ? rawTarget
            : (findNodeHandle(rawTarget as Parameters<typeof findNodeHandle>[0]) ?? null);
        if (target) {
          lastFocusedTargetRef.current = target;
          scrollTargetIntoView(target, 80);
        }
      },
      [scrollTargetIntoView],
    );

    // Calculate dynamic bottom padding so focused bottom fields always have scroll headroom
    const flatContentStyle = StyleSheet.flatten(contentContainerStyle) || {};
    const basePaddingBottom =
      typeof flatContentStyle.paddingBottom === 'number'
        ? flatContentStyle.paddingBottom
        : 16;
    const dynamicPaddingBottom =
      keyboardHeight > 0
        ? Math.max(basePaddingBottom, keyboardHeight + extraKeyboardOffset + 24)
        : basePaddingBottom;
    const scrollContent = (
      <FocusableView style={styles.flex} onFocusCapture={handleFocusCapture}>
        <ScrollView
          ref={internalScrollRef}
          style={[styles.flex, style]}
          contentContainerStyle={[
            contentContainerStyle,
            { paddingBottom: dynamicPaddingBottom },
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode={keyboardDismissMode}
          automaticallyAdjustKeyboardInsets={automaticallyAdjustKeyboardInsets}
          showsVerticalScrollIndicator={false}
          {...rest}
        >
          {children}
        </ScrollView>
      </FocusableView>
    );
    const wrappedContent = (
      <KeyboardAwareScrollContext.Provider value={contextValue}>
        {scrollContent}
      </KeyboardAwareScrollContext.Provider>
    );

    if (keyboardAvoiding && Platform.OS === 'ios') {
      return (
        <KeyboardAvoidingView style={styles.flex} behavior="padding">
          {wrappedContent}
        </KeyboardAvoidingView>
      );
    }

    return wrappedContent;
  },
);

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
