import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { GlassCard } from '../../src/components/GlassCard';
import { useTheme } from '../../src/theme/useTheme';

export default function Welcome() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Screen scroll={false}>
      <View style={styles.hero}>
        <Text style={{ fontSize: theme.typeRamp.displaySmall.fontSize, fontWeight: theme.typeRamp.displaySmall.fontWeight as any, letterSpacing: -1, color: theme.colors.text }}>Expyrico</Text>
        <Text style={{ fontSize: theme.typeRamp.bodyLarge.fontSize, color: theme.colors.textMuted }}>
          Track what you have. Never waste again.
        </Text>
      </View>
      <GlassCard>
        <Button
          testID="welcome-sign-in"
          label="Sign in"
          onPress={() => router.push('/(auth)/sign-in')}
        />
        <Button
          testID="welcome-sign-up"
          label="Create account"
          variant="secondary"
          onPress={() => router.push('/(auth)/sign-up')}
        />
      </GlassCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, marginTop: 32, marginBottom: 24 },
});
