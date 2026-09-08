import React from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { useSelectionModeStore } from '../store/selectionModeStore';
import { useDrawerStore } from '../store/drawerStore';
import { SlidingDrawer } from '../components/SlidingDrawer';
import { LeftDrawerMenu } from './LeftDrawerMenu';

import HomeScreen from '../../app/(app)/(tabs)/home';
import DealsScreen from '../../app/(app)/(tabs)/deals';
import GiveawaysScreen from '../../app/(app)/(tabs)/giveaways';
import ProfileScreen from '../../app/(app)/(tabs)/profile';
import ReviewsScreen from '../../app/(app)/(tabs)/reviews';

export type TabsParamList = {
  Home: undefined;
  Giveaways: undefined;
  Deals: undefined;
  Reviews: undefined;
  Profile: undefined;
};

export const TAB_META: Record<
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
  Reviews: {
    icon: 'star',
    label: 'Reviews',
    sublabel: 'Ratings & community',
    badgeBg: 'rgba(245, 166, 35, 0.14)',
    iconColor: '#F5A623',
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
  Reviews: {
    testID: 'reviews-scan-action',
    accessibilityLabel: 'Scan product to review',
    label: 'Scan to review',
    icon: 'scan-outline',
    bg: '#4BAE8A', // Expyrico Fresh Sage
    fg: '#FFFFFF',
    onPress: (nav) => nav.navigate('Scan'),
  },
};

function BottomActionNavBar({ state, navigation }: BottomTabBarProps) {
  const isSelectionMode = useSelectionModeStore((s) => s.isSelectionMode);
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const activeRouteName = state.routes[state.index]?.name as keyof TabsParamList;
  const actionConfig = TAB_ACTIONS[activeRouteName];
  const bottomOffset = insets.bottom > 0 ? insets.bottom + 2 : 12;


  if (isSelectionMode) {
    return null;
  }

  return (
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
      {activeRouteName === 'Home' ? (
        <View
          style={[
            styles.dualActionWrapper,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
          pointerEvents="box-none"
        >
          {/* Left button: Manually input */}
          <Pressable
            testID="home-manual-add-action"
            accessibilityRole="button"
            accessibilityLabel="Manually input item"
            onPress={() => navigation.navigate('Scan', { initialPhase: 'manual' })}
            style={({ pressed }) => [
              styles.manualInputButton,
              {
                backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
                borderRightColor: theme.colors.border,
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={theme.colors.primaryDark}
              style={styles.actionIcon}
            />
            <Text
              style={[styles.manualInputLabel, { color: theme.colors.text }]}
              numberOfLines={1}
            >
              Manually input
            </Text>
          </Pressable>

          {/* Right button: Scan an item */}
          <Pressable
            testID="home-scan-action"
            accessibilityRole="button"
            accessibilityLabel="Scan pantry items"
            onPress={() => navigation.navigate('Scan')}
            style={({ pressed }) => [
              styles.scanActionButton,
              {
                backgroundColor: '#F5A623',
                opacity: pressed ? 0.88 : 1,
              },
            ]}
          >
            <Ionicons
              name="scan-outline"
              size={20}
              color="#2C2C28"
              style={styles.actionIcon}
            />
            <Text style={[styles.scanActionLabel, { color: '#2C2C28' }]} numberOfLines={1}>
              Scan an item
            </Text>
          </Pressable>
        </View>
      ) : actionConfig ? (
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
                maxWidth: width - 48,
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
    </View>
  );
}

const Tabs = createBottomTabNavigator<TabsParamList>();

export function TabsNavigator() {
  return (
    <SlidingDrawer drawerContent={<LeftDrawerMenu />}>
      <Tabs.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => <BottomActionNavBar {...props} />}
        screenListeners={{
          state: (e) => {
            const currentRoute = e.data.state.routes[e.data.state.index]?.name;
            if (currentRoute) {
              useDrawerStore.getState().setActiveTab(currentRoute as keyof TabsParamList);
            }
          },
        }}
      >
        <Tabs.Screen name="Home" component={HomeScreen} />
        <Tabs.Screen name="Giveaways" component={GiveawaysScreen} />
        <Tabs.Screen name="Deals" component={DealsScreen} />
        <Tabs.Screen name="Reviews" component={ReviewsScreen} />
        <Tabs.Screen name="Profile" component={ProfileScreen} />
      </Tabs.Navigator>
    </SlidingDrawer>
  );
}

const styles = StyleSheet.create({
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
  dualActionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 5,
  },
  manualInputButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    height: 48,
    borderRightWidth: 1,
    gap: 5,
  },
  manualInputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  scanActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    height: 48,
    gap: 5,
  },
  scanActionLabel: {
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
