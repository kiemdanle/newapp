import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme/useTheme';

export function AuthBackButton({
  fallback = '/(auth)/welcome',
}: {
  fallback?: string;
}) {
  const router = useRouter();
  const theme = useTheme();

  function onPress() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(fallback as any);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.primary,
          opacity: pressed ? 0.76 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: theme.colors.primary,
            fontSize: theme.typeRamp.titleMedium.fontSize,
            lineHeight: theme.typeRamp.titleMedium.lineHeight,
          },
        ]}
      >
        ‹ Back
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    minWidth: 88,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
    paddingLeft: 12,
    paddingRight: 16,
  },
  label: {
    fontWeight: '700',
    includeFontPadding: false,
  },
});
