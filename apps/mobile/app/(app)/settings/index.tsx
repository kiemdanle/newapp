import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp, AppStackParamList } from '../../../src/navigation/AppNavigator';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';

type RowKey = 'invite' | 'household' | 'theme' | 'add-passkey';

type AppScreen = keyof AppStackParamList;

interface Row {
  key: RowKey;
  label: string;
  subtitle: string;
  screen: AppScreen;
  icon: string;
}

const ACCOUNT_ROWS: Row[] = [
  {
    key: 'invite',
    label: 'Invite friends',
    subtitle: 'Share your invite code',
    screen: 'Invite',
    icon: 'people-outline',
  },
  {
    key: 'household',
    label: 'Household',
    subtitle: 'Share a pantry with your people',
    screen: 'Household',
    icon: 'home-outline',
  },
];

const PREFERENCE_ROWS: Row[] = [
  {
    key: 'theme',
    label: 'Appearance',
    subtitle: 'System, light, or dark',
    screen: 'SettingsTheme',
    icon: 'color-palette-outline',
  },
  {
    key: 'add-passkey',
    label: 'Add a passkey',
    subtitle: 'Sign in with Face ID / Touch ID',
    screen: 'SettingsAddPasskey',
    icon: 'key-outline',
  },
];

/**
 * Shared Expyrico settings row. Grouping gives account actions and app
 * preferences a predictable hierarchy in either system appearance.
 */
function SettingsRow({ row, onPress }: { row: Row; onPress: () => void }) {
  const theme = useTheme();

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
          backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.84 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: theme.colors.bgGlass }]}>
        <Ionicons name={row.icon} size={20} color={theme.colors.primary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.titleMedium.fontSize, fontWeight: theme.typeRamp.titleMedium.fontWeight as any }}>{row.label}</Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typeRamp.labelMedium.fontSize }}>{row.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
}

export default function SettingsIndex() {
  const navigation = useNavigation<AppNavigationProp>();
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
      <Text style={[styles.intro, { color: theme.colors.textMuted }]}>Make Expyrico fit the way you share and shop.</Text>
      <SettingsGroup title="Your account" rows={ACCOUNT_ROWS} onPress={(screen) => (navigation.push as (screen: AppScreen) => void)(screen)} />
      <SettingsGroup title="App preferences" rows={PREFERENCE_ROWS} onPress={(screen) => (navigation.push as (screen: AppScreen) => void)(screen)} />
    </Screen>
  );
}

function SettingsGroup({ title, rows, onPress }: { title: string; rows: Row[]; onPress: (screen: AppScreen) => void }) {
  const theme = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: theme.colors.textMuted }]}>{title}</Text>
      <View style={[styles.rows, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border, borderRadius: theme.radii.lg }]}>
        {rows.map((row, index) => (
          <React.Fragment key={row.key}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: theme.colors.border }]} /> : null}
            <SettingsRow row={row} onPress={() => onPress(row.screen)} />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 15, lineHeight: 22, marginTop: -6, marginBottom: 8 },
  group: { gap: 8 },
  groupTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginLeft: 4 },
  rows: { borderWidth: 1, overflow: 'hidden' },
  row: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 3 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
});
