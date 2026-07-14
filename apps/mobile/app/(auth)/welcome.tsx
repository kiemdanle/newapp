import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { Logo, LogoLockup } from '../../src/components/Logo';
import { useTheme } from '../../src/theme/useTheme';

export default function Welcome() {
  const router = useRouter();
  const theme = useTheme();
  const { height, width } = useWindowDimensions();
  const compact = height < 740;
  const logoSize = Math.min(compact ? 86 : 104, width * 0.28);

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.shell}>
        <View style={styles.brandBar}>
          <Logo size={36} withWordmark />
          <View
            style={[
              styles.brandPill,
              {
                backgroundColor: theme.colors.bgGlass,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={{
                color: theme.colors.primary,
                fontSize: theme.typeRamp.labelMedium.fontSize,
                fontWeight: theme.typeRamp.labelMedium.fontWeight as any,
              }}
            >
              Fresh
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <LogoLockup width={Math.max(168, logoSize * 1.95)} />
          <View style={styles.logoAccent}>
            <View style={[styles.logoAccentPrimary, { backgroundColor: theme.colors.primary }]} />
            <View style={[styles.logoAccentSecondary, { backgroundColor: theme.colors.accent }]} />
          </View>

          <Text
            style={{
              color: theme.colors.text,
              fontSize: compact ? 34 : 38,
              lineHeight: compact ? 40 : 46,
              fontWeight: theme.typeRamp.displayMedium.fontWeight as any,
              textAlign: 'center',
              marginTop: compact ? 22 : 30,
            }}
          >
            Eat fresh, waste less.
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: theme.typeRamp.bodyLarge.fontSize,
              lineHeight: theme.typeRamp.bodyLarge.lineHeight,
              textAlign: 'center',
              marginTop: 10,
            }}
          >
            Keep your pantry visible, catch expiry dates early, and choose what to use next.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            testID="welcome-sign-up"
            label="Create account"
            variant="primary"
            onPress={() => router.push('/(auth)/sign-up')}
          />
          <Button
            testID="welcome-sign-in"
            label="Sign in"
            variant="outline"
            onPress={() => router.push('/(auth)/sign-in')}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 26,
  },
  brandBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandPill: {
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 28,
  },
  logoAccent: {
    width: 80,
    height: 4,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
    marginTop: 16,
  },
  logoAccentPrimary: {
    flex: 2,
  },
  logoAccentSecondary: {
    flex: 1,
  },
  actions: {
    gap: 12,
  },
});
