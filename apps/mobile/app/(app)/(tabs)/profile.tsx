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

interface ActionRowProps {
  testID: string;
  accessibilityLabel: string;
  icon: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  badge?: React.ReactNode;
  isDestructive?: boolean;
}

function ActionRow({
  testID,
  accessibilityLabel,
  icon,
  label,
  subtitle,
  onPress,
  badge,
  isDestructive = false,
}: ActionRowProps) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionRow,
        {
          backgroundColor: pressed
            ? isDestructive
              ? 'rgba(224, 68, 42, 0.08)'
              : theme.colors.bgGlass
            : 'transparent',
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.actionRowMain}>
        <View
          style={[
            styles.iconWrapper,
            {
              backgroundColor: isDestructive
                ? 'rgba(224, 68, 42, 0.1)'
                : theme.colors.bgGlass,
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={isDestructive ? theme.colors.danger : theme.colors.primary}
          />
        </View>

        <View style={styles.actionRowCopy}>
          <Text
            style={[
              styles.actionRowLabel,
              { color: isDestructive ? theme.colors.danger : theme.colors.text },
            ]}
          >
            {label}
          </Text>
          {subtitle ? (
            <Text
              style={[
                styles.actionRowSubtitle,
                { color: isDestructive ? theme.colors.danger : theme.colors.textMuted },
              ]}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.actionRowTrailing}>
        {badge}
        <Ionicons
          name="chevron-forward"
          size={18}
          color={isDestructive ? theme.colors.danger : theme.colors.textMuted}
          style={{ opacity: 0.6 }}
        />
      </View>
    </Pressable>
  );
}

export default function Profile() {
  const navigation = useNavigation<AppNavigationProp>();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);

  const draftsQuery = useProductDrafts();
  const draftCount = draftsQuery.data?.pages?.flatMap((p) => p.items)?.length ?? 0;

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

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || 'Expyrico User';

  return (
    <Screen contentContainerStyle={{ paddingBottom: 84 }}>
      {/* Header */}
      <View style={styles.header}>
        <Logo size={32} withWordmark />
        <Text style={[styles.headerSubcopy, { color: theme.colors.textMuted }]}>
          Account, activity, and preferences.
        </Text>
      </View>

      {/* Hero Bento Profile Card */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
            shadowColor: theme.colors.neutralDark,
            shadowOpacity: 0.05,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 3,
          },
        ]}
      >
        <Pressable
          testID="profile-user-card"
          accessibilityRole="button"
          accessibilityLabel="Edit profile"
          onPress={() => navigation.push('ProfileEdit')}
          style={({ pressed }) => [
            styles.heroTopRow,
            {
              backgroundColor: pressed ? theme.colors.bgGlass : 'transparent',
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Avatar
            testID="profile-header-avatar"
            url={user?.avatarUrl}
            firstName={user?.firstName}
            lastName={user?.lastName}
            size="lg"
            style={styles.avatarBorder}
          />

          <View style={styles.heroUserMeta}>
            <View style={styles.heroNameRow}>
              <Text style={[styles.heroUserName, { color: theme.colors.text }]} numberOfLines={1}>
                {fullName}
              </Text>
              <View
                style={[
                  styles.editPill,
                  {
                    backgroundColor: theme.colors.primaryLight,
                  },
                ]}
              >
                <Ionicons name="pencil" size={11} color={theme.colors.primaryDark} />
                <Text style={[styles.editPillText, { color: theme.colors.primaryDark }]}>Edit</Text>
              </View>
            </View>

            <View style={styles.heroEmailRow}>
              <Text
                style={[styles.heroUserEmail, { color: theme.colors.textMuted }]}
                numberOfLines={1}
              >
                {user?.email || 'No email attached'}
              </Text>
              {user?.emailVerified ? (
                <View style={styles.verifiedIcon}>
                  <Ionicons name="checkmark-circle" size={14} color={theme.colors.primary} />
                </View>
              ) : null}
            </View>
          </View>
        </Pressable>

        {/* Bento Quick Status Bar */}
        <View style={[styles.heroBentoBar, { borderTopColor: theme.colors.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.bentoItem,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Open my product drafts"
            onPress={() => navigation.push('ProductDrafts')}
          >
            <Ionicons
              name="document-text-outline"
              size={14}
              color={draftCount > 0 ? theme.colors.accent : theme.colors.textMuted}
            />
            <Text
              style={[
                styles.bentoLabel,
                { color: draftCount > 0 ? theme.colors.text : theme.colors.textMuted },
              ]}
            >
              {draftCount > 0 ? `${draftCount} draft${draftCount === 1 ? '' : 's'}` : 'No drafts'}
            </Text>
          </Pressable>

          {!user?.hasPassword ? (
            <>
              <View style={[styles.bentoDivider, { backgroundColor: theme.colors.border }]} />
              <Pressable
                style={({ pressed }) => [
                  styles.bentoItem,
                  { opacity: pressed ? 0.7 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Set account password"
                onPress={() => navigation.push('ProfilePassword')}
              >
                <Ionicons
                  name="shield-outline"
                  size={14}
                  color={theme.colors.accent}
                />
                <Text style={[styles.bentoLabel, { color: theme.colors.accent }]}>
                  No password
                </Text>
              </Pressable>
            </>
          ) : null}
          <View style={[styles.bentoDivider, { backgroundColor: theme.colors.border }]} />

          <Pressable
            style={({ pressed }) => [
              styles.bentoItem,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Account active, open settings"
            onPress={() => navigation.push('SettingsIndex')}
          >
            <Ionicons name="checkmark-done-circle-outline" size={14} color={theme.colors.primary} />
            <Text style={[styles.bentoLabel, { color: theme.colors.text }]}>Active</Text>
          </Pressable>
        </View>
      </View>

      {/* Section 1: Account & Security */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          ACCOUNT & SECURITY
        </Text>
        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <ActionRow
            testID="profile-edit-row"
            accessibilityLabel="Edit profile details"
            icon="person-outline"
            label="Personal details"
            subtitle="Name, address, avatar & country"
            onPress={() => navigation.push('ProfileEdit')}
          />

          <View style={[styles.rowDivider, { backgroundColor: theme.colors.border }]} />

          <ActionRow
            testID="profile-password-row"
            accessibilityLabel="Manage password and security"
            icon="key-outline"
            label={user?.hasPassword ? 'Change password' : 'Set account password'}
            subtitle={
              user?.hasPassword
                ? 'Update your email sign-in password'
                : 'Add password for email login'
            }
            onPress={() => navigation.push('ProfilePassword')}
          />
        </View>
      </View>

      {/* Section 2: Community & Contributions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          COMMUNITY & CONTRIBUTIONS
        </Text>
        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <ActionRow
            testID="profile-drafts"
            accessibilityLabel="Open my product drafts"
            icon="document-text-outline"
            label="My product drafts"
            subtitle="Products awaiting community review"
            onPress={() => navigation.push('ProductDrafts')}
            badge={
              draftCount > 0 ? (
                <View
                  style={[
                    styles.countPill,
                    { backgroundColor: theme.colors.accentLight },
                  ]}
                >
                  <Text
                    style={[
                      styles.countPillText,
                      { color: theme.colors.primaryDark },
                    ]}
                  >
                    {draftCount} pending
                  </Text>
                </View>
              ) : null
            }
          />
        </View>
      </View>

      {/* Section 3: Preferences */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          PREFERENCES & APP
        </Text>
        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <ActionRow
            testID="profile-settings"
            accessibilityLabel="Open settings"
            icon="settings-outline"
            label="Settings"
            subtitle="Appearance, passkeys & household"
            onPress={() => navigation.push('SettingsIndex')}
          />
        </View>
      </View>

      {/* Section 4: Support & Feedback */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.colors.textMuted }]}>
          SUPPORT & FEEDBACK
        </Text>
        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <ActionRow
            testID="profile-feedback-row"
            accessibilityLabel="Help and feedback"
            icon="chatbubble-ellipses-outline"
            label="Help & feedback"
            subtitle="Report bugs, send feedback, or submit suggestions"
            onPress={() => navigation.push('FeedbackHub')}
          />
        </View>
      </View>

      {/* Section 4: Session Actions */}
      <View style={[styles.section, { marginBottom: 32 }]}>
        <View
          style={[
            styles.groupedCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: 'rgba(224, 68, 42, 0.25)',
              borderRadius: theme.radii.lg,
            },
          ]}
        >
          <ActionRow
            testID="profile-sign-out"
            accessibilityLabel="Sign out of Expyrico"
            icon="log-out-outline"
            label="Sign out"
            subtitle="Log out of this device"
            onPress={onSignOut}
            isDestructive
          />
        </View>

        <View style={styles.footerNote}>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
            Expyrico • Fresh & Waste-Free Pantry
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
    marginTop: 0,
  },
  headerSubcopy: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  heroCard: {
    borderWidth: 1,
    marginBottom: 22,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  avatarBorder: {
    borderWidth: 2,
    borderColor: 'rgba(75, 174, 138, 0.2)',
  },
  heroUserMeta: {
    flex: 1,
    gap: 4,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  heroUserName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 3.5,
    borderRadius: 12,
  },
  editPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  heroUserEmail: {
    fontSize: 13,
    flexShrink: 1,
  },
  verifiedIcon: {
    marginTop: 1,
  },
  heroBentoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.015)',
  },
  bentoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bentoLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  bentoDivider: {
    width: 1,
    height: 14,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  groupedCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  actionRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRowCopy: {
    flex: 1,
    gap: 2,
  },
  actionRowLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionRowSubtitle: {
    fontSize: 12,
  },
  actionRowTrailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  rowDivider: {
    height: 1,
    marginLeft: 62,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  countPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerNote: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 8,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
});
