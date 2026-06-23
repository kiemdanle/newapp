import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { Logo } from '../../../src/components/Logo';
import { useTheme } from '../../../src/theme/useTheme';
import { useSessionStore } from '../../../src/auth/session-store';
import { authEndpoints } from '../../../src/api/endpoints';

export default function Profile() {
  const router = useRouter();
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
        <Logo size={32} withWordmark />
      </View>

      <View
        style={[
          styles.userCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderRadius: theme.radii.lg,
            shadowColor: '#2C2C28',
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.avatarText}>{initials.toUpperCase() || '?'}</Text>
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
          onPress={() => router.push('/(app)/settings')}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: theme.colors.bgElevated,
              borderRadius: theme.radii.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.rowLabel, { color: theme.colors.text }]}>Settings</Text>
          <Text style={[styles.rowChevron, { color: theme.colors.textMuted }]}>›</Text>
        </Pressable>

        <Pressable
          testID="profile-sign-out"
          accessibilityRole="button"
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
          <Text style={[styles.rowLabel, { color: theme.colors.danger }]}>Sign out</Text>
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
  avatarText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
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
    fontWeight: '500',
  },
  rowChevron: {
    fontSize: 20,
    fontWeight: '400',
  },
});
