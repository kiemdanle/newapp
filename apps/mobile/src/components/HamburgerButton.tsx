import React from 'react';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { useDrawerStore } from '../store/drawerStore';

export interface HamburgerButtonProps {
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

export function HamburgerButton({
  testID = 'top-nav-menu-button',
  style,
}: HamburgerButtonProps) {
  const theme = useTheme();
  const isOpen = useDrawerStore((s) => s.isOpen);
  const toggleDrawer = useDrawerStore((s) => s.toggleDrawer);

  return (
    <Pressable
      onPress={toggleDrawer}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        style,
      ]}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={
        isOpen ? 'Close navigation menu' : 'Open navigation menu'
      }
      accessibilityState={{ expanded: isOpen }}
      testID={testID}
    >
      <Ionicons
        name="menu-outline"
        size={24}
        color={theme.colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
});
