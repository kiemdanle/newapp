import React from 'react';
import { StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../../src/navigation/AppNavigator';
import { Screen } from '../../../src/components/Screen';
import { Logo } from '../../../src/components/Logo';
import { Avatar } from '../../../src/components/Avatar';
import { useTheme } from '../../../src/theme/useTheme';
import { useSessionStore } from '../../../src/auth/session-store';
import { authEndpoints } from '../../../src/api/endpoints';
import { useProductDrafts } from '../../../src/api/products';
import { getCountryMetadata } from '../../../src/utils/country-format';

export default function Profile() {
  const navigation = useNavigation<AppNavigationProp>();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);

  const draftsQuery = useProductDrafts();
  const draftCount = draftsQuery.data?.pages?.flatMap((p) => p.items)?.length ?? 0;

  const countryMeta = getCountryMetadata(user?.country);

  async function onSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of Expyrico?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await authEndpoints.logout();
          } catch {
            /* best-effort */
          }
          await signOut();
        },
      },
    ]);
  }

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

      {/* Hero User Card */}
      <Pressable
        testID="profile-user-card"
        accessibilityRole="button"
        accessibilityLabel="Edit profile"
        onPress={() => navigation.push('ProfileEdit')}
        style={({ pressed }) => [
          styles.userCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
            opacity: pressed ? 0.92 : 1,
            shadowColor: theme.colors.neutralDark,
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          },
        ]}
      >
        <Avatar
          testID="profile-header-avatar"
          url={user?.avatarUrl}
          firstName={user?.firstName}
          lastName={user?.lastName}
          size="lg"
        />

        <View style={styles.userMeta}>
          <View style={styles.nameRow}>
            <Text style={[styles.userName, { color: theme.colors.text }]}>
              {user?.firstName} {user?.lastName}
            </Text>
            <View style={[styles.editPill, { backgroundColor: theme.colors.primaryLight }]}>
              <Ionicons name="pencil" size={12} color={theme.colors.primaryDark} />
              <Text style={[styles.editPillText, { color: theme.colors.primaryDark }]}>Edit</Text>
            </View>
          </View>

          <View style={styles.emailRow}>
            <Text style={[styles.userEmail, { color: theme.colors.textMuted }]}>
              {user?.email}
            </Text>
            {user?.emailVerified ? (
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
            ) : null}
          </View>

          <View style={styles.badgeRow}>
            {user?.country ? (
              <View style={[styles.infoBadge, { backgroundColor: theme.colors.bgGlass }]}>
                <Text style={styles.badgeFlag}>{countryMeta.flag}</Text>
                <Text style={[styles.badgeText, { color: theme.colors.text }]}>
                  {countryMeta.name}
                </Text>
              </View>
            ) : null}

            {user?.address ? (
              <View style={[styles.infoBadge, { backgroundColor: theme.colors.bgGlass, flex: 1 }]}>
                <Ionicons name="location-outline" size={12} color={theme.colors.textMuted} />
                <Text style={[styles.badgeText, { color: theme.colors.textMuted }]} numberOfLines={1}>
                  {user.address}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>

      {/* Navigation Rows */}
      <View style={{ gap: 8, marginTop: 4 }}>
        <Pressable
          testID="profile-edit-row"
          accessibilityRole="button"
          accessibilityLabel="Edit profile details"
          onPress={() => navigation.push('ProfileEdit')}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.rowMain}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.colors.bgGlass }]}>
              <Ionicons name="person-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>Edit profile</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                Name, address, avatar & country
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Pressable>

        <Pressable
          testID="profile-password-row"
          accessibilityRole="button"
          accessibilityLabel="Manage password and security"
          onPress={() => navigation.push('ProfilePassword')}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.rowMain}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.colors.bgGlass }]}>
              <Ionicons name="key-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>
                {user?.hasPassword ? 'Change password' : 'Set account password'}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                {user?.hasPassword ? 'Update account password' : 'Add password for email login'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
        </Pressable>

        <Pressable
          testID="profile-drafts"
          accessibilityRole="button"
          accessibilityLabel="Open my product drafts"
          onPress={() => navigation.push('ProductDrafts')}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.rowMain}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.colors.bgGlass }]}>
              <Ionicons name="document-text-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>My product drafts</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                Products awaiting submission & review
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {draftCount > 0 && (
              <View style={[styles.countBadge, { backgroundColor: theme.colors.primaryLight }]}>
                <Text style={[styles.countBadgeText, { color: theme.colors.primaryDark }]}>
                  {draftCount}
                </Text>
              </View>
            )}
            <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
          </View>
        </Pressable>

        <Pressable
          testID="profile-settings"
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          onPress={() => navigation.push('SettingsIndex')}
          style={({ pressed }) => [
            styles.row,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={styles.rowMain}>
            <View style={[styles.iconWrapper, { backgroundColor: theme.colors.bgGlass }]}>
              <Ionicons name="settings-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ gap: 2 }}>
              <Text style={[styles.rowLabel, { color: theme.colors.text }]}>Settings</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                Appearance, passkeys & household
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
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
              marginTop: 12,
            },
          ]}
        >
          <View style={styles.rowMain}>
            <View style={[styles.iconWrapper, { backgroundColor: 'rgba(224,68,42,0.1)' }]}>
              <Ionicons name="log-out-outline" size={18} color={theme.colors.danger} />
            </View>
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
    padding: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  userMeta: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  editPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userEmail: {
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  infoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeFlag: {
    fontSize: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    minHeight: 58,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  countBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
