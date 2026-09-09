import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextStyle, type TextInputProps } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  showPasswordToggle?: boolean;
}

export function TextField({
  label,
  error,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  showPasswordToggle,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const isPassword = Boolean(secureTextEntry || showPasswordToggle);
  const [passwordHidden, setPasswordHidden] = useState(true);

  const resolvedAutoCapitalize = autoCapitalize ?? (isPassword ? 'none' : undefined);
  const resolvedAutoCorrect = autoCorrect ?? (isPassword ? false : undefined);
  const resolvedSecureTextEntry = isPassword ? passwordHidden : secureTextEntry;

  const handleContainerPress = () => {
    inputRef.current?.focus();
  };

  return (
    <View style={styles.wrap}>
      <Text
        onPress={handleContainerPress}
        style={[
          styles.label,
          {
            color: theme.colors.textMuted,
            fontSize: theme.typeRamp.labelMedium.fontSize,
            fontWeight: theme.typeRamp.labelMedium.fontWeight as TextStyle['fontWeight'],
          },
        ]}
      >
        {label}
      </Text>
      <Pressable
        onPress={handleContainerPress}
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.neutralMid,
            borderRadius: theme.radii.md,
          },
        ]}
      >
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          placeholderTextColor={theme.colors.textMuted}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          autoCapitalize={resolvedAutoCapitalize}
          autoCorrect={resolvedAutoCorrect}
          secureTextEntry={resolvedSecureTextEntry}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              fontSize: theme.typeRamp.bodyLarge.fontSize,
              borderColor: error ? theme.colors.danger : focused ? theme.colors.primary : theme.colors.border,
            },
          ]}
          {...rest}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordHidden ? 'Show password' : 'Hide password'}
            accessibilityHint="Toggles password visibility"
            testID={rest.testID ? `${rest.testID}-toggle-visibility` : 'toggle-password-visibility'}
            hitSlop={8}
            onPress={() => setPasswordHidden((prev) => !prev)}
            style={styles.toggleButton}
          >
            <Ionicons
              name={passwordHidden ? 'eye-outline' : 'eye-off-outline'}
              size={22}
              color={theme.colors.textMuted}
            />
          </Pressable>
        ) : null}
      </Pressable>
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    minHeight: 52,
  },
  input: {
    flex: 1,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  toggleButton: {
    paddingRight: 16,
    paddingLeft: 8,
    minHeight: 48,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { marginTop: 2 },
});
