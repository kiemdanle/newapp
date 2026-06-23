import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
}

export function TextField({ label, error, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.textMuted,
            fontSize: theme.typeRamp.labelMedium.fontSize,
            fontWeight: theme.typeRamp.labelMedium.fontWeight as any,
          },
        ]}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={theme.colors.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.border,
            color: theme.colors.text,
            borderRadius: theme.radii.md,
            fontSize: theme.typeRamp.bodyLarge.fontSize,
          },
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.error, { color: theme.colors.danger, fontSize: theme.typeRamp.labelMedium.fontSize }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  label: { letterSpacing: 0.2 },
  input: { borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 13 },
  error: { marginTop: 2 },
});
