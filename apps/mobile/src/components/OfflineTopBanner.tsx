import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { useConnectionStore } from '../store/connectionStore';
import { useConnectionGuardStore } from '../store/connectionGuardStore';

export function OfflineTopBanner() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.scheme === 'dark';

  const status = useConnectionStore((s) => s.status);
  const requireServerConnection = useConnectionGuardStore((s) => s.requireServerConnection);

  if (status === 'ready' || status === 'checking') {
    return null;
  }

  const isOffline = status === 'offline';
  const label = isOffline
    ? 'Offline Mode • Server actions paused'
    : 'Server Unreachable • Server actions paused';

  const textColor = isOffline ? theme.colors.danger : theme.colors.warning;
  const bgColor = isDark
    ? isOffline
      ? 'rgba(224, 68, 42, 0.18)'
      : 'rgba(245, 166, 35, 0.18)'
    : isOffline
    ? 'rgba(224, 68, 42, 0.10)'
    : 'rgba(245, 166, 35, 0.12)';

  const borderColor = isDark
    ? isOffline
      ? 'rgba(224, 68, 42, 0.35)'
      : 'rgba(245, 166, 35, 0.35)'
    : isOffline
    ? 'rgba(224, 68, 42, 0.25)'
    : 'rgba(245, 166, 35, 0.25)';

  const handlePress = () => {
    requireServerConnection('Server Sync', () => {});
  };

  return (
    <Pressable
      style={[
        styles.banner,
        {
          paddingTop: Math.max(insets.top, 8) + 4,
          backgroundColor: bgColor,
          borderBottomColor: borderColor,
        },
      ]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="offline-top-banner"
    >
      <View style={styles.content}>
        <Ionicons
          name={isOffline ? 'cloud-offline-outline' : 'warning-outline'}
          size={14}
          color={textColor}
          style={styles.icon}
        />
        <Text style={[styles.text, { color: textColor }]}>
          {label}
        </Text>
        <Ionicons name="chevron-forward-outline" size={12} color={textColor} style={styles.chevron} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    minHeight: 44,
    paddingBottom: 6,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  chevron: {
    marginLeft: 4,
    opacity: 0.8,
  },
});
