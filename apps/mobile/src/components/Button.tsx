import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/useTheme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function Button(props: ButtonProps) {
  const theme = useTheme();
  const variant = props.variant ?? 'primary';

  // Filled Honey — primary CTA
  // Filled Sage — secondary action
  // Outlined Sage border + transparent — tertiary, visible but not loud
  // Ghost — text only, minimal
  // Danger — filled Alert Red
  const isFilled = variant === 'primary' || variant === 'secondary' || variant === 'danger';
  const bg =
    variant === 'primary'
      ? theme.colors.accent
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.primary
          : 'transparent';

  const isTertiary = variant === 'outline' || variant === 'ghost';
  const fg = isFilled ? theme.colors.textInverse : isTertiary ? theme.colors.primary : theme.colors.text;

  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.label}
      disabled={props.disabled || props.loading}
      onPress={props.onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: theme.radii.pill,
          opacity: (pressed || props.disabled) && isFilled ? 0.82 : 1,
        },
        // Outlined: sage border + sage text, fills on press
        variant === 'outline' && {
          borderWidth: 1.5,
          borderColor: theme.colors.primary,
          backgroundColor: pressed ? theme.colors.bgGlass : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
        // Ghost: compact text/icon action without adding a competing container.
        variant === 'ghost' && {
          borderColor: 'transparent',
          backgroundColor: pressed ? theme.colors.neutralLight : 'transparent',
          opacity: pressed ? 0.7 : 1,
        },
        // Filled press: add tactile feedback without introducing another brand color.
        pressed && variant === 'primary' && { opacity: 0.82 },
        pressed && variant === 'secondary' && { backgroundColor: theme.colors.hero },
        pressed && variant === 'danger' && { opacity: 0.82 },
      ]}
    >
      <View style={styles.row}>
        {props.loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {props.icon ? (
              <Ionicons
                name={props.icon}
                size={18}
                color={isTertiary ? theme.colors.primary : fg}
              />
            ) : null}
            <Text
              style={[
                styles.label,
                {
                  color: fg,
                  fontSize: theme.typeRamp.labelLarge.fontSize,
                  lineHeight: theme.typeRamp.labelLarge.lineHeight,
                  fontWeight: '700',
                },
              ]}
            >
              {props.label}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    minHeight: 52,
    justifyContent: 'center',
    paddingVertical: 0,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  row: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
