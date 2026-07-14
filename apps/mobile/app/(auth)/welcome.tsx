import React from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { AuthBrandBar, AuthHeader } from '../../src/components/AuthHeader';

export default function Welcome() {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const compact = height < 700;

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.shell}>
        <AuthBrandBar />
        <View style={[styles.hero, compact && styles.heroCompact]}>
          <AuthHeader
            title="Eat fresh, waste less."
            description="Keep your pantry visible, catch expiry dates early, and choose what to use next."
          />
        </View>
        <View style={styles.actions}>
          <Button testID="welcome-sign-up" label="Create account" onPress={() => router.push('/(auth)/sign-up')} />
          <Button testID="welcome-sign-in" label="Sign in" variant="outline" onPress={() => router.push('/(auth)/sign-in')} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  hero: { flex: 1, justifyContent: 'center', paddingBottom: 32 },
  heroCompact: { justifyContent: 'flex-start', paddingTop: 42, paddingBottom: 16 },
  actions: { gap: 12 },
});
