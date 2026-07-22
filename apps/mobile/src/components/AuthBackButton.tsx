import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { useTheme } from '../theme/useTheme';

export function AuthBackButton({
  fallback,
}: {
  fallback?: string;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const theme = useTheme();

  function onPress() {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else if (fallback) {
      switch (fallback) {
        case '/(auth)/welcome':
        case '/welcome':
          navigation.replace('Welcome');
          break;
        case '/(auth)/sign-in':
        case '/sign-in':
          navigation.replace('SignIn');
          break;
        case '/(auth)/forgot-password':
        case '/forgot-password':
          navigation.replace('ForgotPassword');
          break;
        default:
          navigation.replace('Welcome');
          break;
      }
    } else {
      navigation.replace('Welcome');
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
    minHeight: 44,
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
