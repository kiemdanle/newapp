import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface OtpInputProps {
  value: string;
  onChangeText: (next: string) => void;
  /** Accessible label for the underlying input (also used by tests). */
  label: string;
  length?: number;
  autoFocus?: boolean;
  editable?: boolean;
  error?: boolean;
}

/**
 * Segmented one-time-code input. A single transparent TextInput sits on top of
 * `length` visual cells so OS autofill (iOS one-time-code / Android sms-otp)
 * keeps working, while each digit renders in its own slot.
 *
 * Palette semantics (Expyrico): a filled slot fills with Mint Mist (fresh /
 * confirmed), the active slot glows Honey with a caret (Honey = the app's
 * act-now colour, so the cursor sits on the action colour), empty slots rest in
 * Stone. Errors tint every slot with Alert Red.
 */
export function OtpInput({
  value,
  onChangeText,
  label,
  length = 6,
  autoFocus,
  editable = true,
  error,
}: OtpInputProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const cells = Array.from({ length }, (_, i) => i);

  // One deliberate motion: a gentle pulse when the final digit lands, confirming
  // the code is complete and about to submit. Respect reduce-motion.
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useRef(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (mounted) reduceMotion.current = on;
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (value.length !== length || reduceMotion.current) return;
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.03, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
    ]).start();
  }, [value.length, length, scale]);

  function handleChange(raw: string) {
    onChangeText(raw.replace(/\D/g, '').slice(0, length));
  }

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.row, { transform: [{ scale }] }]} pointerEvents="none">
        {cells.map((i) => {
          const char = value[i] ?? '';
          const filled = char !== '';
          const active = editable && i === value.length && value.length < length;
          const borderColor = error
            ? theme.colors.danger
            : active
              ? theme.colors.accent
              : filled
                ? theme.colors.primary
                : theme.colors.border;
          const backgroundColor = error
            ? theme.colors.accentLight
            : active
              ? theme.colors.accentLight
              : filled
                ? theme.colors.primaryLight
                : theme.colors.neutralLight;
          return (
            <View
              key={i}
              style={[
                styles.cell,
                {
                  backgroundColor,
                  borderColor,
                  borderWidth: active ? 2 : 1.5,
                  borderRadius: theme.radii.md,
                },
              ]}
            >
              {char ? (
                <Text style={[styles.digit, { color: theme.colors.text }]}>{char}</Text>
              ) : active ? (
                <View style={[styles.caret, { backgroundColor: theme.colors.accent }]} />
              ) : null}
            </View>
          );
        })}
      </Animated.View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        accessibilityLabel={label}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.select({ ios: 'one-time-code', android: 'sms-otp', default: 'one-time-code' })}
        maxLength={length}
        autoFocus={autoFocus}
        editable={editable}
        caretHidden
        selectionColor="transparent"
        style={styles.hiddenInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  row: { flexDirection: 'row', gap: 10 },
  cell: {
    flex: 1,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
  },
  digit: {
    fontSize: 26,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
  caret: { width: 2, height: 26, borderRadius: 1 },
  // Transparent input overlaid on the cells: captures taps, keyboard, and
  // OS autofill without showing its own text or caret.
  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: 'transparent',
    fontSize: 1,
    textAlign: 'center',
  },
});
