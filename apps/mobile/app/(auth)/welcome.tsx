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
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme.colors.bgGlass,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.xl,
          },
        ]}
      >
        <Logo size={86} />
        <Text
          style={{
            fontSize: 40,
            fontWeight: '700',
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
          Track what you have, spot what expires next, and waste less food.
        </Text>
        <View style={styles.metrics}>
          <View style={[styles.metric, { backgroundColor: theme.colors.bgElevated }]}>
            <Text style={[styles.metricValue, { color: theme.colors.primary }]}>Fresh</Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>pantry view</Text>
          </View>
          <View style={[styles.metric, { backgroundColor: theme.colors.bgElevated }]}>
            <Text style={[styles.metricValue, { color: theme.colors.accent }]}>Soon</Text>
            <Text style={[styles.metricLabel, { color: theme.colors.textMuted }]}>expiry alerts</Text>
          </View>
        </View>
      </View>
      <View style={styles.footer}>
        <Button
          testID="welcome-sign-in"
          label="Sign in"
          icon="log-in"
          onPress={() => router.push('/(auth)/sign-in')}
        />
        <Button
          testID="welcome-sign-up"
          label="Create account"
          icon="person-add"
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
    borderWidth: 1,
    gap: 0,
    marginTop: 12,
    padding: 26,
  },
  footer: {
    gap: 12,
    paddingBottom: 12,
  },
  metrics: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
    width: '100%',
  },
  metric: {
    flex: 1,
    padding: 12,
    borderRadius: 18,
  },
  metricValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 2,
  },
});
