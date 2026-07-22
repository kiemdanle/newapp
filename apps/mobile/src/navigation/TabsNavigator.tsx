import React from 'react';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
  { icon: keyof typeof Ionicons.glyphMap; label: string }
> = {
  Home: { icon: 'home', label: 'Home' },
  Giveaways: { icon: 'gift', label: 'Give' },
  Deals: { icon: 'pricetag', label: 'Deals' },
  Profile: { icon: 'person', label: 'You' },
};

export function isCompactTabLayout(width: number) {
  return width < 390;
}

function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const compact = isCompactTabLayout(width);

  return (
    <View style={[styles.wrapper, { bottom: 16 + Math.max(insets.bottom, 0) }]} pointerEvents="box-none">
      <View
        style={[
          styles.bar,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.pill,
            shadowColor: theme.colors.neutralDark,
            shadowOpacity: 0.10,
            shadowRadius: 16,
            shadowOffset: { width: 0, height: 4 },
            elevation: 6,
          },
        ]}
      >
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
          };

          return (
            <Pressable
              key={route.key}
              testID={`nav-${route.name}`}
              accessibilityRole="button"
              accessibilityLabel={meta.label}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tab,
                compact && styles.tabCompact,
                {
                  backgroundColor: isFocused ? theme.colors.primaryLight : 'transparent',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Ionicons
                name={meta.icon}
                size={20}
                color={isFocused ? theme.colors.primaryDark : theme.colors.textMuted}
                style={{ marginBottom: 1 }}
              />
              {isFocused && !compact && (
                <Text style={[styles.label, { color: theme.colors.primaryDark }]} numberOfLines={1}>
                  {meta.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const Tabs = createBottomTabNavigator<TabsParamList>();

export function TabsNavigator() {
  return (
    <Tabs.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Giveaways" component={GiveawaysScreen} />
      <Tabs.Screen name="Deals" component={DealsScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minWidth: 48,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 999,
    minHeight: 48,
  },
  tabCompact: {
    gap: 0,
    paddingHorizontal: 0,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});
