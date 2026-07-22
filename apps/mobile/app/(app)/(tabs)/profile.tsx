import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import { Screen } from '../../../src/components/Screen';
import { Logo } from '../../../src/components/Logo';
import { useTheme } from '../../../src/theme/useTheme';
import { useSessionStore } from '../../../src/auth/session-store';
import { authEndpoints } from '../../../src/api/endpoints';

export default function Profile() {
  const navigation = useNavigation<AppNavigationProp>();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);

  async function onSignOut() {
    try {
      await authEndpoints.logout();
    } catch {
      /* best-effort */
    }
    await signOut();
  }

  const initials = (user?.firstName?.[0] ?? '') + (user?.lastName?.[0] ?? '');

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Logo size={34} withWordmark />
          <Text style={[styles.headerSubcopy, { color: theme.colors.textMuted }]}>
            Account, security, and app preferences.
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.userCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderRadius: theme.radii.lg,
            shadowColor: theme.colors.neutralDark,
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.colors.bgGlass }]}>
          <Ionicons name="person" size={18} color={theme.colors.primary} style={styles.avatarIcon} />
          <Text style={[styles.avatarText, { color: theme.colors.hero }]}>
            {initials.toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.userMeta}>
          <Text style={[styles.userName, { color: theme.colors.text }]}>
            {user?.firstName} {user?.lastName}
          </Text>
          <Text style={[styles.userEmail, { color: theme.colors.textMuted }]}>
            {user?.email}
          </Text>
        </View>
      </View>

      <View style={{ gap: 8, marginTop: 4 }}>
        <Pressable
          testID="profile-settings"
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => navigation.push('SettingsIndex')}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: theme.colors.bgElevated,
              borderRadius: theme.radii.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.rowMain}>
            <Ionicons name="settings-outline" size={20} color={theme.colors.primary} />
            <Text style={[styles.rowLabel, { color: theme.colors.text }]}>Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
        </Pressable>

        <Pressable
          testID="profile-sign-out"
          accessibilityRole="button"
          accessibilityLabel="Sign out of Expyrico"
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: pressed ? 'rgba(224,68,42,0.08)' : theme.colors.bgElevated,
              borderRadius: theme.radii.md,
              borderColor: 'rgba(224,68,42,0.25)',
              borderWidth: 1,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.rowMain}>
            <Ionicons name="log-out-outline" size={20} color={theme.colors.danger} />
            <Text style={[styles.rowLabel, { color: theme.colors.danger }]}>Sign out</Text>
          </View>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  headerSubcopy: {
    fontSize: 13,
    marginTop: 4,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    marginBottom: 24,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    position: 'absolute',
    opacity: 0.24,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  userMeta: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 18,
    minHeight: 52,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
