import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { useSyncStateStore } from '../store/syncStateStore';
import { runSync } from '../db/sync';

export interface SyncStatusBarProps {
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SyncStatusBar({ style, testID }: SyncStatusBarProps) {
  const theme = useTheme();
  const isSyncing = useSyncStateStore((s) => s.isSyncing);
  const initialSyncCompleted = useSyncStateStore((s) => s.initialSyncCompleted);
  const lastSyncError = useSyncStateStore((s) => s.lastSyncError);
  // Suppress status bar during fresh-install initial sync (skeleton shimmer handles initial visual feedback)
  if (!initialSyncCompleted && lastSyncError !== 'timeout') {
    return null;
  }

  if (!isSyncing && lastSyncError !== 'timeout' && !lastSyncError) {
    return null;
  }
  const isTimeout = lastSyncError === 'timeout';

  const handlePress = () => {
    if (!isSyncing) {
      void runSync();
    }
  };

  return (
    <Pressable
      testID={testID ?? 'sync-status-bar'}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={
        isTimeout
          ? 'Offline, showing local pantry. Tap to retry sync.'
          : isSyncing
            ? 'Syncing pantry items with server'
            : `Sync status: ${lastSyncError}`
      }
      style={[
        styles.container,
        {
          backgroundColor: isTimeout ? theme.colors.accentLight : theme.colors.bgGlass,
          borderColor: isTimeout ? theme.colors.accent : theme.colors.border,
        },
        style,
      ]}
    >
      <Ionicons
        name={isTimeout ? 'cloud-offline-outline' : 'sync-outline'}
        size={14}
        color={isTimeout ? theme.colors.accent : theme.colors.primaryDark}
        style={styles.icon}
      />
      <Text
        style={[
          styles.text,
          {
            color: isTimeout ? theme.colors.neutralDark : theme.colors.primaryDark,
          },
        ]}
        numberOfLines={1}
      >
        {isTimeout
          ? 'Offline — showing local pantry (tap to retry)'
          : isSyncing
            ? 'Syncing pantry...'
            : 'Sync error — tap to retry'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 6,
  },
  icon: {
    marginRight: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
  },
});
