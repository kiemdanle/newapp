import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface Props {
  notification: InAppNotification | null;
  onPress: (data?: Record<string, unknown>) => void;
  onDismiss: () => void;
}

export function InAppNotificationBanner({ notification, onPress, onDismiss }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    if (notification) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      const timer = setTimeout(() => {
        dismiss();
      }, 6000);

      return () => clearTimeout(timer);
    } else {
      translateY.setValue(-120);
    }
  }, [notification]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: -140,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onDismiss();
    });
  };

  if (!notification) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 8,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        testID="in-app-notification-banner"
        accessibilityRole="button"
        accessibilityLabel={`${notification.title}: ${notification.body}`}
        style={({ pressed }) => [
          styles.banner,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
            shadowColor: theme.colors.text,
            opacity: pressed ? 0.92 : 1,
          },
        ]}
        onPress={() => {
          dismiss();
          onPress(notification.data);
        }}
      >
        <View style={[styles.iconWrapper, { backgroundColor: theme.colors.primaryLight }]}>
          <Ionicons name="notifications-outline" size={22} color={theme.colors.primaryDark} />
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={[styles.body, { color: theme.colors.textMuted }]} numberOfLines={2}>
            {notification.body}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          onPress={dismiss}
          hitSlop={12}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    gap: 12,
  },
  iconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
  closeButton: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
});
