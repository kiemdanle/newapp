// apps/mobile/src/components/QuantityPromptModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';

export interface QuantityPromptModalProps {
  visible: boolean;
  itemName: string;
  maxQuantity: number;
  unit: string;
  actionType: 'consumed' | 'discarded';
  onClose: () => void;
  onConfirm: (quantity: number) => void;
}

export function QuantityPromptModal({
  visible,
  itemName,
  maxQuantity,
  unit,
  actionType,
  onClose,
  onConfirm,
}: QuantityPromptModalProps) {
  const theme = useTheme();
  const [selectedQty, setSelectedQty] = useState(1);

  useEffect(() => {
    if (visible) {
      setSelectedQty(1);
    }
  }, [visible]);

  const handleDecrement = () => {
    setSelectedQty((q) => Math.max(1, q - 1));
  };

  const handleIncrement = () => {
    setSelectedQty((q) => Math.min(maxQuantity, q + 1));
  };

  const actionVerb = actionType === 'consumed' ? 'used' : 'discarded';
  const actionTitle = actionType === 'consumed' ? 'Mark as used' : 'Mark as discarded';
  const confirmLabel =
    selectedQty === maxQuantity
      ? `Mark all ${maxQuantity} ${unit}`
      : `Mark ${selectedQty} ${unit}`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close quantity selector"
        />
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={actionType === 'consumed' ? 'checkmark-circle-outline' : 'trash-outline'}
                size={24}
                color={actionType === 'consumed' ? theme.colors.primary : theme.colors.accent}
              />
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              {actionTitle}
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              How many {unit} of &quot;{itemName}&quot; would you like to mark as {actionVerb}?
            </Text>
          </View>

          {/* Stepper row */}
          <View
            style={[
              styles.stepperContainer,
              { backgroundColor: theme.colors.bg, borderColor: theme.colors.border },
            ]}
          >
            <Pressable
              testID="qty-prompt-decrement"
              accessibilityRole="button"
              accessibilityLabel="Decrease quantity"
              disabled={selectedQty <= 1}
              onPress={handleDecrement}
              style={({ pressed }) => [
                styles.stepperBtn,
                {
                  backgroundColor: theme.colors.bgElevated,
                  opacity: selectedQty <= 1 ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="remove" size={20} color={theme.colors.text} />
            </Pressable>

            <View style={styles.stepperValueWrap}>
              <Text testID="qty-prompt-value" style={[styles.stepperValue, { color: theme.colors.text }]}>
                {selectedQty}
              </Text>
              <Text style={[styles.stepperMax, { color: theme.colors.textMuted }]}>
                of {maxQuantity} {unit}
              </Text>
            </View>

            <Pressable
              testID="qty-prompt-increment"
              accessibilityRole="button"
              accessibilityLabel="Increase quantity"
              disabled={selectedQty >= maxQuantity}
              onPress={handleIncrement}
              style={({ pressed }) => [
                styles.stepperBtn,
                {
                  backgroundColor: theme.colors.bgElevated,
                  opacity: selectedQty >= maxQuantity ? 0.4 : pressed ? 0.7 : 1,
                },
              ]}
            >
              <Ionicons name="add" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Preset shortcuts */}
          <View style={styles.presetsRow}>
            {maxQuantity > 1 && (
              <Pressable
                testID="qty-preset-one"
                onPress={() => setSelectedQty(1)}
                style={({ pressed }) => [
                  styles.presetPill,
                  {
                    backgroundColor:
                      selectedQty === 1 ? theme.colors.primaryLight : theme.colors.bg,
                    borderColor:
                      selectedQty === 1 ? theme.colors.primary : theme.colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    {
                      color:
                        selectedQty === 1 ? theme.colors.primaryDark : theme.colors.textMuted,
                      fontWeight: selectedQty === 1 ? '700' : '500',
                    },
                  ]}
                >
                  1 {unit}
                </Text>
              </Pressable>
            )}

            {maxQuantity > 2 && (
              <Pressable
                testID="qty-preset-half"
                onPress={() => setSelectedQty(Math.max(1, Math.round(maxQuantity / 2)))}
                style={({ pressed }) => [
                  styles.presetPill,
                  {
                    backgroundColor:
                      selectedQty === Math.max(1, Math.round(maxQuantity / 2))
                        ? theme.colors.primaryLight
                        : theme.colors.bg,
                    borderColor:
                      selectedQty === Math.max(1, Math.round(maxQuantity / 2))
                        ? theme.colors.primary
                        : theme.colors.border,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    {
                      color:
                        selectedQty === Math.max(1, Math.round(maxQuantity / 2))
                          ? theme.colors.primaryDark
                          : theme.colors.textMuted,
                      fontWeight:
                        selectedQty === Math.max(1, Math.round(maxQuantity / 2))
                          ? '700'
                          : '500',
                    },
                  ]}
                >
                  Half ({Math.max(1, Math.round(maxQuantity / 2))} {unit})
                </Text>
              </Pressable>
            )}

            <Pressable
              testID="qty-preset-all"
              onPress={() => setSelectedQty(maxQuantity)}
              style={({ pressed }) => [
                styles.presetPill,
                {
                  backgroundColor:
                    selectedQty === maxQuantity ? theme.colors.primaryLight : theme.colors.bg,
                  borderColor:
                    selectedQty === maxQuantity ? theme.colors.primary : theme.colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.presetText,
                  {
                    color:
                      selectedQty === maxQuantity ? theme.colors.primaryDark : theme.colors.textMuted,
                    fontWeight: selectedQty === maxQuantity ? '700' : '500',
                  },
                ]}
              >
                All ({maxQuantity} {unit})
              </Text>
            </Pressable>
          </View>

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <View style={styles.actionBtn}>
              <Button
                testID="qty-prompt-cancel"
                label="Cancel"
                variant="outline"
                onPress={onClose}
              />
            </View>
            <View style={styles.actionBtn}>
              <Button
                testID="qty-prompt-confirm"
                label={confirmLabel}
                onPress={() => onConfirm(selectedQty)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(75, 174, 138, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    minHeight: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperValueWrap: {
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 26,
    fontWeight: '800',
  },
  stepperMax: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
    flexWrap: 'wrap',
  },
  presetPill: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  presetText: {
    fontSize: 13,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
  },
});
