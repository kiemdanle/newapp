import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Rect, Path, G } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

import HomeScreen from '../../app/(app)/(tabs)/home';
import DealsScreen from '../../app/(app)/(tabs)/deals';
import GiveawaysScreen from '../../app/(app)/(tabs)/giveaways';
import ProfileScreen from '../../app/(app)/(tabs)/profile';

export type TabsParamList = {
  Home: undefined;
  Deals: undefined;
  Giveaways: undefined;
  Profile: undefined;
};

const TAB_META: Record<
  keyof TabsParamList,
  {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    sublabel: string;
    badgeBg: string;
    iconColor: string;
  }
> = {
  Home: {
    icon: 'home',
    label: 'Home',
    sublabel: 'Pantry inventory',
    badgeBg: 'rgba(75, 174, 138, 0.14)',
    iconColor: '#3A8F6F',
  },
  Giveaways: {
    icon: 'gift',
    label: 'Giveaways',
    sublabel: 'Share food & items',
    badgeBg: 'rgba(245, 166, 35, 0.14)',
    iconColor: '#F5A623',
  },
  Deals: {
    icon: 'pricetag',
    label: 'Deals',
    sublabel: 'Grocery discounts',
    badgeBg: 'rgba(75, 174, 138, 0.14)',
    iconColor: '#3A8F6F',
  },
  Profile: {
    icon: 'person',
    label: 'Profile',
    sublabel: 'Account & settings',
    badgeBg: 'rgba(140, 140, 133, 0.14)',
    iconColor: '#8C8C85',
  },
};

export function isCompactTabLayout(width: number) {
  return width < 390;
}

interface ActionConfig {
  testID: string;
  accessibilityLabel: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  bg: string;
  fg: string;
  onPress: (nav: any) => void;
}

const TAB_ACTIONS: Partial<Record<keyof TabsParamList, ActionConfig>> = {
  Home: {
    testID: 'home-scan-action',
    accessibilityLabel: 'Scan pantry items',
    label: 'Scan an item',
    icon: 'scan-outline',
    bg: '#F5A623', // Expyrico Honey CTA
    fg: '#2C2C28', // Almost Black
    onPress: (nav) => nav.navigate('Scan'),
  },
  Giveaways: {
    testID: 'giveaway-new-action',
    accessibilityLabel: 'Create a giveaway',
    label: 'Create giveaway',
    icon: 'gift-outline',
    bg: '#4BAE8A', // Expyrico Fresh Sage
    fg: '#FFFFFF',
    onPress: (nav) => nav.navigate('GiveawayNew'),
  },
  Deals: {
    testID: 'deal-new-action',
    accessibilityLabel: 'Post a deal',
    label: 'Post a deal',
    icon: 'pricetag-outline',
    bg: '#4BAE8A', // Expyrico Fresh Sage
    fg: '#FFFFFF',
    onPress: (nav) => nav.navigate('DealNew'),
  },
};

/**
 * Signature Bento App Matrix Menu Icon
 * Crafted with Expyrico Fresh Sage & Honey accent geometric tiles.
 */
function SignatureMenuIcon({ isOpen, size = 22 }: { isOpen: boolean; size?: number }) {
  const theme = useTheme();

  if (isOpen) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          d="M6 6L18 18M18 6L6 18"
          stroke={theme.colors.primaryDark}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Top-Left: Expyrico Fresh Sage */}
      <Rect x="3.2" y="3.2" width="7.8" height="7.8" rx="2.6" fill="#4BAE8A" />
      {/* Top-Right: Text Primary */}
      <Rect x="13" y="3.2" width="7.8" height="7.8" rx="2.6" fill={theme.colors.text} />
      {/* Bottom-Left: Text Primary */}
      <Rect x="3.2" y="13" width="7.8" height="7.8" rx="2.6" fill={theme.colors.text} />
      {/* Bottom-Right: Expyrico Honey Accent */}
      <Rect x="13" y="13" width="7.8" height="7.8" rx="2.6" fill="#F5A623" />
    </Svg>
  );
}

function BottomActionNavBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(menuAnim, {
      toValue: isMenuOpen ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 65,
    }).start();
  }, [isMenuOpen, menuAnim]);

  const activeRouteName = state.routes[state.index]?.name as keyof TabsParamList;
  const actionConfig = TAB_ACTIONS[activeRouteName];

  const bottomOffset = insets.bottom > 0 ? insets.bottom + 2 : 12;

  const toggleMenu = useCallback(() => {
    setIsMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const menuOpacity = menuAnim;
  const menuTranslateY = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [18, 0],
  });
  const menuScale = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.90, 1],
  });

  const iconRotation = menuAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  return (
    <>
      {/* Backdrop overlay when vertical menu is open */}
      {isMenuOpen && (
        <TouchableWithoutFeedback onPress={closeMenu} testID="bottom-nav-backdrop">
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
      )}

      {/* Floating vertical popover menu placed above the bottom right menu button */}
      <Animated.View
        pointerEvents={isMenuOpen ? 'auto' : 'none'}
        style={[
          styles.verticalMenuContainer,
          {
            bottom: bottomOffset + 60,
            opacity: menuOpacity,
            transform: [{ translateY: menuTranslateY }, { scale: menuScale }],
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.neutralDark,
          },
        ]}
      >
        <View style={styles.menuHeaderRow}>
          <Text style={[styles.menuHeaderTitle, { color: theme.colors.textMuted }]}>MENU</Text>
        </View>

        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TAB_META[route.name as keyof TabsParamList];
          if (!meta) return null;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as keyof TabsParamList);
            }
            closeMenu();
          };

          return (
            <Pressable
              key={route.key}
              testID={`nav-${route.name}`}
              accessibilityRole="button"
              accessibilityLabel={meta.label}
              onPress={onPress}
              style={({ pressed }) => [
                styles.menuItem,
                {
                  backgroundColor: isFocused
                    ? theme.colors.primaryLight
                    : pressed
                      ? theme.colors.bgGlass
                      : 'transparent',
                },
              ]}
            >
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.menuItemIconBadge,
                    {
                      backgroundColor: isFocused ? '#FFFFFF' : meta.badgeBg,
                    },
                  ]}
                >
                  <Ionicons
                    name={meta.icon}
                    size={18}
                    color={isFocused ? theme.colors.primaryDark : meta.iconColor}
                  />
                </View>
                <View style={styles.menuItemCopy}>
                  <Text
                    style={[
                      styles.menuItemLabel,
                      {
                        color: isFocused ? theme.colors.primaryDark : theme.colors.text,
                        fontWeight: isFocused ? '700' : '600',
                      },
                    ]}
                  >
                    {meta.label}
                  </Text>
                  <Text
                    style={[
                      styles.menuItemSublabel,
                      {
                        color: isFocused ? theme.colors.primaryDark : theme.colors.textMuted,
                        opacity: isFocused ? 0.8 : 1,
                      },
                    ]}
                  >
                    {meta.sublabel}
                  </Text>
                </View>
              </View>
              {isFocused ? (
                <View
                  style={[
                    styles.activeIndicatorPill,
                    { backgroundColor: theme.colors.primaryDark },
                  ]}
                >
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Animated.View>

      {/* Unified Bottom Bar Row */}
      <View
        style={[
          styles.bottomRowWrapper,
          {
            bottom: bottomOffset,
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Center-aligned Action Button */}
        {actionConfig ? (
          <View style={styles.centerActionWrapper} pointerEvents="box-none">
            <Pressable
              testID={actionConfig.testID}
              accessibilityRole="button"
              accessibilityLabel={actionConfig.accessibilityLabel}
              onPress={() => actionConfig.onPress(navigation)}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  backgroundColor: actionConfig.bg,
                  maxWidth: width - 110,
                  opacity: pressed ? 0.88 : 1,
                  shadowColor: '#000',
                },
              ]}
            >
              <Ionicons
                name={actionConfig.icon}
                size={20}
                color={actionConfig.fg}
                style={styles.actionIcon}
              />
              <Text style={[styles.actionLabel, { color: actionConfig.fg }]} numberOfLines={1}>
                {actionConfig.label}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* Right-aligned Menu Icon Button */}
        <Pressable
          testID="bottom-nav-menu-button"
          accessibilityRole="button"
          accessibilityLabel={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          accessibilityState={{ expanded: isMenuOpen }}
          onPress={toggleMenu}
          style={({ pressed }) => [
            styles.menuButton,
            {
              backgroundColor: isMenuOpen ? theme.colors.primaryLight : theme.colors.bgElevated,
              borderColor: isMenuOpen ? theme.colors.primary : theme.colors.border,
              opacity: pressed ? 0.85 : 1,
              shadowColor: '#000',
            },
          ]}
        >
          <Animated.View style={{ transform: [{ rotate: iconRotation }] }}>
            <SignatureMenuIcon isOpen={isMenuOpen} size={22} />
          </Animated.View>
        </Pressable>
      </View>
    </>
  );
}

const Tabs = createBottomTabNavigator<TabsParamList>();

export function TabsNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomActionNavBar {...props} />}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Giveaways" component={GiveawaysScreen} />
      <Tabs.Screen name="Deals" component={DealsScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    zIndex: 99,
  },
  verticalMenuContainer: {
    position: 'absolute',
    right: 16,
    minWidth: 200,
    borderRadius: 22,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    zIndex: 100,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 12,
  },
  menuHeaderRow: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 6,
  },
  menuHeaderTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 16,
    minHeight: 52,
    marginVertical: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  menuItemIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemCopy: {
    gap: 2,
    flex: 1,
  },
  menuItemLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  menuItemSublabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  activeIndicatorPill: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  bottomRowWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 101,
  },
  centerActionWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    height: 48,
    borderRadius: 999,
    gap: 8,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  actionIcon: {
    marginRight: -2,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  menuButton: {
    position: 'absolute',
    right: 16,
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 6,
  },
});
