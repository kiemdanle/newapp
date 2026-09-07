// apps/mobile/src/components/DiscardReasonModal.tsx
import React from 'react';
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

export interface DiscardReasonModalProps {
  visible: boolean;
  itemName: string;
  onClose: () => void;
  onSelectReason: (reason: string) => void;
}

interface ReasonOption {
  key: string;
  label: string;
  description: string;
  icon: string;
  testID: string;
}

const REASON_OPTIONS: ReasonOption[] = [
  {
    key: 'expired',
    label: 'Expired',
    description: 'Past its expiration date',
    icon: 'alarm-outline',
    testID: 'discard-reason-expired',
  },
  {
    key: 'spoiled',
    label: 'Spoiled',
    description: 'Molded, bad odor, or ruined texture',
    icon: 'warning-outline',
    testID: 'discard-reason-spoiled',
  },
  {
    key: 'overbought',
    label: 'Overbought',
    description: 'Bought too much and could not finish in time',
    icon: 'cart-outline',
    testID: 'discard-reason-overbought',
  },
  {
    key: 'leftovers',
    label: 'Leftovers',
    description: 'Unfinished portion or meal leftovers',
    icon: 'restaurant-outline',
    testID: 'discard-reason-leftovers',
  },
  {
    key: 'other',
    label: 'Other',
    description: 'Unusual, accidental, or other reason',
    icon: 'ellipsis-horizontal-circle-outline',
    testID: 'discard-reason-other',
  },
];

export function DiscardReasonModal({
  visible,
  itemName,
  onClose,
  onSelectReason,
}: DiscardReasonModalProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close discard reason selector"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Handle indicator */}
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: theme.colors.border }]} />
          </View>

          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Why was this discarded?
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              Select a reason for &quot;{itemName}&quot; to track and reduce future food waste.
            </Text>
          </View>

          {/* Reason options */}
          <View style={styles.optionsList}>
            {REASON_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                testID={opt.testID}
                accessibilityRole="button"
                accessibilityLabel={`${opt.label}: ${opt.description}`}
                onPress={() => onSelectReason(opt.key)}
                style={({ pressed }) => [
                  styles.optionCard,
                  {
                    backgroundColor: theme.colors.bg,
                    borderColor: theme.colors.border,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconCircle,
                    {
                      backgroundColor:
                        opt.key === 'expired' || opt.key === 'spoiled'
                          ? 'rgba(224, 68, 42, 0.12)'
                          : 'rgba(245, 166, 35, 0.12)',
                    },
                  ]}
                >
                  <Ionicons
                    name={opt.icon}
                    size={20}
                    color={
                      opt.key === 'expired' || opt.key === 'spoiled'
                        ? theme.colors.danger
                        : theme.colors.accent
                    }
                  />
                </View>
                <View style={styles.optionTextWrap}>
                  <Text style={[styles.optionLabel, { color: theme.colors.text }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.optionDescription, { color: theme.colors.textMuted }]}>
                    {opt.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              </Pressable>
            ))}
          </View>

          <View style={styles.cancelBtn}>
            <Button
              testID="discard-reason-cancel"
              label="Cancel"
              variant="outline"
              onPress={onClose}
            />
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
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  handleWrap: {
    alignItems: 'center',
    marginBottom: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  optionsList: {
    gap: 10,
    marginBottom: 16,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  optionTextWrap: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  optionDescription: {
    fontSize: 12,
  },
  cancelBtn: {
    marginTop: 4,
  },
});
