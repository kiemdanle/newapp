import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';

interface Row {
  key: string;
  label: string;
  subtitle: string;
  href: Href;
}

const ROWS: Row[] = [
  {
    key: 'theme',
    label: 'Theme',
    subtitle: 'Pick one of four looks',
    href: '/(app)/settings/theme',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    subtitle: 'Expiry reminders and alerts',
    href: '/(app)/settings/notifications',
  },
  {
    key: 'account',
    label: 'Account',
    subtitle: 'Email, password, and passkeys',
    href: '/(app)/settings/account',
  },
  {
    key: 'add-passkey',
    label: 'Add a passkey',
    subtitle: 'Sign in with Face ID / Touch ID',
    href: '/(app)/settings/add-passkey',
  },
];

export default function SettingsIndex() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text }}>Settings</Text>
      <View style={{ gap: 10 }}>
        {ROWS.map((row) => (
          <Pressable
            key={row.key}
            testID={`settings-row-${row.key}`}
            accessibilityRole="button"
            accessibilityLabel={row.label}
            onPress={() => router.push(row.href)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: theme.colors.bgElevated,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.lg,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
              {row.label}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>{row.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, padding: 16, gap: 4 },
});
