import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

export function Button(props: ButtonProps) {
  const theme = useTheme();
  const variant = props.variant ?? 'primary';

  const bg =
    variant === 'primary'
      ? theme.colors.accent          // Honey — CTAs per spec
      : variant === 'danger'
        ? theme.colors.danger
        : variant === 'secondary'
          ? theme.colors.primary     // Fresh Sage — secondary actions
          : 'transparent';

  const fg =
    variant === 'primary' || variant === 'danger'
      ? '#FFFFFF'
      : variant === 'secondary'
        ? theme.colors.primaryFg
        : theme.colors.text;

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
          opacity: pressed ? 0.82 : 1,
        },
        variant === 'ghost' && {
          borderWidth: 1.5,
          borderColor: theme.colors.border,
          backgroundColor: 'transparent',
        },
        (pressed && variant === 'primary') && { backgroundColor: '#D8901A' },
        (pressed && variant === 'secondary') && { backgroundColor: theme.colors.hero },
      ]}
    >
      <View style={styles.row}>
        {props.loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <Text
            style={[
              styles.label,
              {
                color: fg,
                fontSize: theme.typeRamp.labelLarge.fontSize,
                fontWeight: theme.typeRamp.labelLarge.fontWeight as any,
              },
            ]}
          >
            {props.label}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 15,
    paddingHorizontal: 24,
    minHeight: 50,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    textAlign: 'center',
  },
});
