import React from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Logo } from '../components/Logo';
import { Avatar } from '../components/Avatar';
import { useTheme } from '../theme/useTheme';
import { useSessionStore } from '../auth/session-store';
import { usePantryScope } from '../store/pantryScope';
import { useDrawerStore, type TabName } from '../store/drawerStore';
import { authEndpoints } from '../api/endpoints';
import type { AppNavigationProp } from './AppNavigator';

interface NavItemMeta {
  key: TabName;
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
  testID: string;
}

const PRIMARY_NAV_ITEMS: NavItemMeta[] = [
  {
    key: 'Home',
    label: 'Pantry',
    sublabel: 'Expiring & in stock',
    icon: 'grid-outline',
    testID: 'nav-Home',
  },
  {
    key: 'Giveaways',
    label: 'Giveaways',
    sublabel: 'Community food sharing',
    icon: 'gift-outline',
    testID: 'nav-Giveaways',
  },
  {
    key: 'Deals',
    label: 'Deals',
    sublabel: 'Discounted groceries',
    icon: 'pricetag-outline',
    testID: 'nav-Deals',
  },
  {
    key: 'Reviews',
    label: 'Reviews',
    sublabel: 'Community ratings',
    icon: 'star-outline',
    testID: 'nav-Reviews',
  },
  {
    key: 'Profile',
    label: 'Profile',
    sublabel: 'Account & preferences',
    icon: 'person-outline',
    testID: 'nav-Profile',
  },
];

export function LeftDrawerMenu() {
  const navigation = useNavigation<AppNavigationProp>();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);
  const activeTab = useDrawerStore((s) => s.activeTab);
  const closeDrawer = useDrawerStore((s) => s.closeDrawer);
  const { scope } = usePantryScope();

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') ||
    'Expyrico User';
  const email = user?.email || 'user@expyrico.com';

  const scopeLabel =
    scope === 'household'
      ? 'Household Pantry'
      : scope === 'personal'
      ? 'Personal Pantry'
      : 'All Pantries';

  const handleTabPress = (tabName: TabName) => {
    closeDrawer();
    navigation.navigate('Tabs', { screen: tabName });
  };

  const handleShortcutPress = (
    screenName: 'Scan' | 'Household' | 'SettingsIndex' | 'FeedbackHub'
  ) => {
    closeDrawer();
    navigation.navigate(screenName);
  };

  const handleUserCardPress = () => {
    closeDrawer();
    navigation.navigate('ProfileEdit');
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out of Expyrico?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            closeDrawer();
            try {
              await authEndpoints.logout();
            } catch {
              /* best-effort */
            }
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.bg,
          paddingTop: insets.top,
        },
      ]}
      testID="left-drawer-menu-container"
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        testID="left-drawer-scroll-view"
      >
        {/* Brand Header Row */}
        <View style={styles.brandHeader}>
          <View style={styles.brandInfo}>
            <Logo size={28} withWordmark />
            <Text
              style={[styles.brandSubtitle, { color: theme.colors.textMuted }]}
            >
              Zero Food Waste
            </Text>
          </View>
          <Pressable
            onPress={closeDrawer}
            style={({ pressed }) => [
              styles.closeButton,
              { backgroundColor: theme.colors.border },
              pressed && styles.buttonPressed,
            ]}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            testID="drawer-close-button"
          >
            <Ionicons name="close-outline" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* User Card */}
        <Pressable
          onPress={handleUserCardPress}
          style={({ pressed }) => [
            styles.userCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Signed in as ${fullName}`}
          testID="drawer-user-card"
        >
          <Avatar
            url={user?.avatarUrl}
            firstName={user?.firstName}
            lastName={user?.lastName}
            size="md"
          />
          <View style={styles.userInfo}>
            <Text
              style={[styles.userName, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              {fullName}
            </Text>
            <Text
              style={[styles.userEmail, { color: theme.colors.textMuted }]}
              numberOfLines={1}
            >
              {email}
            </Text>
            <View
              style={[
                styles.scopeBadge,
                { backgroundColor: theme.colors.primaryLight },
              ]}
            >
              <Ionicons
                name={scope === 'household' ? 'people' : 'person'}
                size={11}
                color={theme.colors.primaryDark}
              />
              <Text
                style={[
                  styles.scopeText,
                  { color: theme.colors.primaryDark },
                ]}
              >
                {scopeLabel}
              </Text>
            </View>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={theme.colors.textMuted}
            style={styles.cardChevron}
          />
        </Pressable>

        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Primary Menu Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textMuted }]}
          >
            MENU
          </Text>
          {PRIMARY_NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => handleTabPress(item.key)}
                style={({ pressed }) => [
                  styles.navItem,
                  isActive && { backgroundColor: theme.colors.primaryLight },
                  pressed && styles.buttonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: isActive }}
                testID={item.testID}
              >
                <View
                  style={[
                    styles.navIconContainer,
                    {
                      backgroundColor: isActive
                        ? theme.colors.bgElevated
                        : theme.colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={
                      isActive ? theme.colors.primary : theme.colors.textMuted
                    }
                  />
                </View>
                <View style={styles.navTextContainer}>
                  <Text
                    style={[
                      styles.navLabel,
                      {
                        color: isActive
                          ? theme.colors.primaryDark
                          : theme.colors.text,
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={[
                      styles.navSublabel,
                      {
                        color: isActive
                          ? theme.colors.primaryDark
                          : theme.colors.textMuted,
                      },
                    ]}
                  >
                    {item.sublabel}
                  </Text>
                </View>
                {isActive && (
                  <View
                    style={[
                      styles.activeCheckPill,
                      { backgroundColor: theme.colors.primary },
                    ]}
                  >
                    <Ionicons name="checkmark" size={12} color="#FFF" />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Secondary Shortcuts Section */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.textMuted }]}
          >
            QUICK ACCESS
          </Text>

          <Pressable
            onPress={() => handleShortcutPress('Scan')}
            style={({ pressed }) => [
              styles.shortcutItem,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Scan Barcode"
            testID="shortcut-scan"
          >
            <Ionicons
              name="barcode-outline"
              size={18}
              color={theme.colors.text}
            />
            <Text
              style={[styles.shortcutLabel, { color: theme.colors.text }]}
            >
              Scan Barcode
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleShortcutPress('Household')}
            style={({ pressed }) => [
              styles.shortcutItem,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Household Sharing"
            testID="shortcut-household"
          >
            <Ionicons
              name="people-outline"
              size={18}
              color={theme.colors.text}
            />
            <Text
              style={[styles.shortcutLabel, { color: theme.colors.text }]}
            >
              Household Sharing
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleShortcutPress('SettingsIndex')}
            style={({ pressed }) => [
              styles.shortcutItem,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Settings and Theme"
            testID="shortcut-settings"
          >
            <Ionicons
              name="settings-outline"
              size={18}
              color={theme.colors.text}
            />
            <Text
              style={[styles.shortcutLabel, { color: theme.colors.text }]}
            >
              Settings & Theme
            </Text>
          </Pressable>

          <Pressable
            onPress={() => handleShortcutPress('FeedbackHub')}
            style={({ pressed }) => [
              styles.shortcutItem,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Feedback and Support"
            testID="shortcut-feedback"
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={18}
              color={theme.colors.text}
            />
            <Text
              style={[styles.shortcutLabel, { color: theme.colors.text }]}
            >
              Feedback & Support
            </Text>
          </Pressable>
        </View>

        <View
          style={[styles.divider, { backgroundColor: theme.colors.border }]}
        />

        {/* Sign Out Action */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [
            styles.signOutItem,
            pressed && styles.buttonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Sign Out"
          testID="drawer-sign-out"
        >
          <Ionicons
            name="log-out-outline"
            size={18}
            color={theme.colors.danger}
          />
          <Text
            style={[styles.signOutLabel, { color: theme.colors.danger }]}
          >
            Sign Out
          </Text>
        </Pressable>

        {/* Footer Version */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
            Expyrico v1.0 • Fresh Pantry
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 44,
  },
  brandInfo: {
    flex: 1,
  },
  brandSubtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
  },
  userInfo: {
    flex: 1,
    marginLeft: 10,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 12,
    marginTop: 1,
  },
  scopeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  scopeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  cardChevron: {
    marginLeft: 4,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    minHeight: 48,
  },
  navIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTextContainer: {
    flex: 1,
    marginLeft: 10,
  },
  navLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  navSublabel: {
    fontSize: 11,
    marginTop: 1,
  },
  activeCheckPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  shortcutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    minHeight: 44,
    gap: 10,
  },
  shortcutLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  signOutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    minHeight: 44,
    gap: 10,
  },
  signOutLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 11,
  },
});
