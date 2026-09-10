import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ProductDraftRow } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';

export interface PendingDiscardEntry {
  item: ProductDraftRow;
  timer: NodeJS.Timeout;
  deadline: number;
  isCommitting: boolean;
}

export interface DraftUndoToastProps {
  entries: PendingDiscardEntry[];
  onUndo: (id: string) => void;
}

export function DraftUndoToast({ entries, onUndo }: DraftUndoToastProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(20)).current;
  const wasVisibleRef = useRef(false);

  const activeEntries = entries.filter((e) => !e.isCommitting);
  const isVisible = activeEntries.length > 0;

  useEffect(() => {
    if (process.env.NODE_ENV === 'test') {
      opacityAnim.setValue(isVisible ? 1 : 0);
      translateYAnim.setValue(isVisible ? 0 : 20);
      wasVisibleRef.current = isVisible;
      return;
    }

    const useNativeDriver = Platform.OS !== 'web';
    if (isVisible) {
      wasVisibleRef.current = true;
      const anim = Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver,
        }),
        Animated.spring(translateYAnim, {
          toValue: 0,
          friction: 8,
          tension: 60,
          useNativeDriver,
        }),
      ]);
      anim.start();
      return () => anim.stop();
    }

    if (wasVisibleRef.current) {
      wasVisibleRef.current = false;
      const anim = Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver,
        }),
        Animated.timing(translateYAnim, {
          toValue: 20,
          duration: 180,
          useNativeDriver,
        }),
      ]);
      anim.start();
      return () => anim.stop();
    }
  }, [isVisible, opacityAnim, translateYAnim]);

  if (!isVisible && entries.length === 0) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents={isVisible ? 'box-none' : 'none'}
      style={[
        styles.toastContainer,
        {
          bottom: Math.max(insets.bottom, 16) + 12,
          opacity: opacityAnim,
          transform: [{ translateY: translateYAnim }],
        },
      ]}
    >
      <View
        testID="draft-undo-toast"
        style={[
          styles.toastCard,
          {
            backgroundColor: theme.colors.neutralDark,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {activeEntries.map((entry) => (
          <View key={entry.item.id} style={styles.entryRow}>
            <Text
              style={styles.messageText}
              numberOfLines={1}
            >
              Draft "{entry.item.name || 'Untitled'}" discarded
            </Text>

            <Pressable
              testID={`draft-undo-btn-${entry.item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Undo discard of ${entry.item.name || 'draft'}`}
              onPress={() => onUndo(entry.item.id)}
              hitSlop={8}
              style={({ pressed }) => [
                styles.undoBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
            >
              <Text style={[styles.undoBtnText, { color: theme.colors.accent }]}>
                Undo
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 9999,
  },
  toastCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 3,
  },
  messageText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '500',
  },
  undoBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  undoBtnText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
