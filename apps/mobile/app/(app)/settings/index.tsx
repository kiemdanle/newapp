import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';
import { MD3ListRow } from '../../../src/components/MD3ListRow';

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

/**
 * Theme-adaptive settings row. When the active theme is material, renders
 * `<MD3ListRow>`. All other themes keep the existing Pressable card.
 */
function SettingsRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const theme = useTheme();

  if (theme.id === 'material') {
    return <MD3ListRow title={row.label} subtitle={row.subtitle} onPress={onPress} />;
  }

  return (
    <Pressable
      key={row.key}
      testID={`settings-row-${row.key}`}
      accessibilityRole="button"
      accessibilityLabel={row.label}
      onPress={onPress}
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
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typeRamp.titleMedium.fontSize,
          fontWeight: theme.typeRamp.titleMedium.fontWeight as any,
        }}
      >
        {row.label}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.typeRamp.labelMedium.fontSize }}>
        {row.subtitle}
      </Text>
    </Pressable>
  );
}

export default function SettingsIndex() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Screen>
      <Text
        style={{
          fontSize: theme.typeRamp.headlineSmall.fontSize,
          fontWeight: theme.typeRamp.headlineSmall.fontWeight as any,
          color: theme.colors.text,
        }}
      >
        Settings
      </Text>
      <View style={{ gap: 10 }}>
        {ROWS.map((row) => (
          <SettingsRow key={row.key} row={row} onPress={() => router.push(row.href)} />
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { borderWidth: 1, padding: 16, gap: 4 },
});
