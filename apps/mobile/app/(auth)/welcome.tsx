import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { Logo } from '../../src/components/Logo';
import { useTheme } from '../../src/theme/useTheme';

export default function Welcome() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Logo size={88} />
        <Text
          style={{
            fontSize: 40,
            fontWeight: '600',
            letterSpacing: -1.2,
            color: theme.colors.text,
            marginTop: 20,
          }}
        >
          expyrico
        </Text>
        <Text
          style={{
            fontSize: theme.typeRamp.bodyLarge.fontSize,
            color: theme.colors.textMuted,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 24,
          }}
        >
          Track what you have.{'\n'}Never waste again.
        </Text>
      </View>
      <View style={styles.footer}>
        <Button
          testID="welcome-sign-in"
          label="Sign in"
          onPress={() => router.push('/(auth)/sign-in')}
        />
        <Button
          testID="welcome-sign-up"
          label="Create account"
          variant="outline"
          onPress={() => router.push('/(auth)/sign-up')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  footer: {
    gap: 12,
    paddingBottom: 12,
  },
});
