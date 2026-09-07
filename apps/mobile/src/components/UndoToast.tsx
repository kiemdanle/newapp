// apps/mobile/src/components/UndoToast.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUndoToastStore, type UndoToastAction } from '../store/undoToast';
import { restoreLocalRecord } from '../api/records';
import { useMyHouseholds } from '../api/households';
import { navigationRef } from '../navigation/navigationRef';

export function UndoToast() {
  const insets = useSafeAreaInsets();
  const current = useUndoToastStore((s) => s.current);
  const dismiss = useUndoToastStore((s) => s.dismiss);
  const { data: householdsData } = useMyHouseholds();

  const [activeItem, setActiveItem] = useState<UndoToastAction | null>(null);
  const [isTabScreen, setIsTabScreen] = useState(true);

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(24)).current;

  // Listen to navigation state changes to dynamically adapt bottom offset
  useEffect(() => {
    const tabScreens = ['Home', 'Giveaways', 'Scan', 'Deals', 'Profile', 'Tabs'];
    const onStateChange = () => {
      const routeName = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : null;
      setIsTabScreen(!routeName || tabScreens.includes(routeName));
    };
    onStateChange();
    return navigationRef.addListener('state', onStateChange);
  }, []);

  useEffect(() => {
    const useNativeDriver = Platform.OS !== 'web' && process.env.NODE_ENV !== 'test';
    if (current) {
      setActiveItem(current);
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver,
        }),
        Animated.timing(translateYAnim, {
          toValue: 24,
          duration: 180,
          useNativeDriver,
        }),
      ]).start(() => {
        setActiveItem(null);
      });
    }
  }, [current, opacityAnim, translateYAnim]);

  if (!activeItem || !current) {
    return null;
  }

  const handleUndo = async () => {
    const itemToRestore = activeItem;
    dismiss();

    const accessibleHouseholdIds = householdsData?.items?.map((h) => h.id) ?? [];
    await restoreLocalRecord(itemToRestore.recordId, accessibleHouseholdIds, {
      isSplit: itemToRestore.isSplit,
      parentId: itemToRestore.parentId,
      quantity: itemToRestore.quantity,
    });
  };

  const actionVerb = activeItem.status === 'consumed' ? 'used' : 'discarded';
  const label =
    activeItem.quantity && activeItem.quantity > 1
      ? `${activeItem.quantity} ${activeItem.unit || 'pcs'} marked as ${actionVerb}`
      : `&quot;${activeItem.itemName}&quot; marked as ${actionVerb}`.replace(/&quot;/g, '"');

  // Dynamic bottom offset considering bottom tabs + safe area
  const bottomOffset = insets.bottom + (isTabScreen ? 76 : 20);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.toastWrapper,
        {
          bottom: bottomOffset,
          opacity: opacityAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
    >
      <View
        testID="undo-toast-container"
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={styles.toastContainer}
      >
        <Ionicons
          name={activeItem.status === 'consumed' ? 'checkmark-circle' : 'trash'}
          size={18}
          color={activeItem.status === 'consumed' ? '#4BAE8A' : '#F5A623'}
          style={styles.icon}
        />

        <Text style={styles.toastText} numberOfLines={1}>
          {label}
        </Text>

        <Pressable
          testID="undo-toast-button"
          accessibilityRole="button"
          accessibilityLabel="Undo action"
          onPress={handleUndo}
          style={({ pressed }) => [
            styles.undoBtn,
            { opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={styles.undoText}>Undo</Text>
        </Pressable>

        <Pressable
          testID="undo-toast-dismiss"
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          onPress={dismiss}
          hitSlop={8}
          style={({ pressed }) => [
            styles.dismissBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Ionicons name="close" size={16} color="#8C8C85" />
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C28', // Almost Black
    borderRadius: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxWidth: 500,
    width: '100%',
  },
  icon: {
    marginRight: 10,
  },
  toastText: {
    flex: 1,
    color: '#FAFAF8', // Warm White
    fontSize: 13,
    fontWeight: '500',
  },
  undoBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(75, 174, 138, 0.15)', // Fresh Sage tint
  },
  undoText: {
    color: '#4BAE8A', // Fresh Sage
    fontSize: 13,
    fontWeight: '700',
  },
  dismissBtn: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    marginLeft: 6,
  },
});
