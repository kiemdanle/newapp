import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';

export interface AddDraftOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: () => void;
  onManualEntry: () => void;
}

export function AddDraftOptionsModal({
  visible,
  onClose,
  onScan,
  onManualEntry,
}: AddDraftOptionsModalProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Full screen dismiss overlay */}
        <Pressable
          testID="add-options-dismiss-overlay"
          accessibilityRole="button"
          accessibilityLabel="Dismiss options"
          style={styles.dismissOverlay}
          onPress={onClose}
        />

        {/* Bottom Sheet Card */}
        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {/* Top Drag Handle */}
          <View style={styles.handleBar}>
            <View style={styles.handlePill} />
          </View>

          {/* Header Title Section */}
          <View style={styles.header}>
            <View style={styles.headerIconCircle}>
              <Ionicons name="sparkles" size={18} color="#4BAE8A" />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Add Product Draft</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                Choose how you would like to input the product
              </Text>
            </View>
            <Pressable
              testID="add-options-close-btn"
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Action Cards Container */}
          <View style={styles.actionsContainer}>
            {/* Primary Action: Scan Barcode / QR Code */}
            <Pressable
              testID="add-options-scan-btn"
              accessibilityRole="button"
              accessibilityLabel="Scan barcode or QR code"
              onPress={() => {
                onClose();
                onScan();
              }}
              style={({ pressed }) => [
                styles.actionCard,
                styles.primaryCard,
                {
                  backgroundColor: pressed ? '#C7EADB' : '#D6F0E6',
                  borderColor: '#4BAE8A',
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: '#4BAE8A' }]}>
                <Ionicons name="barcode-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.actionTextCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.actionTitle, { color: '#2A6F54' }]}>Scan Barcode / QR Code</Text>
                  <View style={styles.badgePill}>
                    <Text style={styles.badgePillText}>CAMERA</Text>
                  </View>
                </View>
                <Text style={[styles.actionSubtitle, { color: '#3A8F6F' }]}>
                  Point your phone camera directly at the packaging
                </Text>
              </View>
              <View style={[styles.actionChevronCircle, { backgroundColor: 'rgba(75, 174, 138, 0.2)' }]}>
                <Ionicons name="chevron-forward" size={16} color="#2A6F54" />
              </View>
            </Pressable>

            {/* Secondary Action: Enter Code Manually */}
            <Pressable
              testID="add-options-manual-btn"
              accessibilityRole="button"
              accessibilityLabel="Enter barcode manually"
              onPress={() => {
                onClose();
                onManualEntry();
              }}
              style={({ pressed }) => [
                styles.actionCard,
                styles.secondaryCard,
                {
                  backgroundColor: pressed
                    ? theme.colors.bgGlass
                    : theme.scheme === 'dark'
                      ? theme.colors.bgElevated
                      : '#FFFFFF',
                  borderColor: theme.colors.border,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: theme.scheme === 'dark' ? '#333330' : '#F0F0ED' },
                ]}
              >
                <Ionicons name="keypad-outline" size={22} color={theme.colors.text} />
              </View>
              <View style={styles.actionTextCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.actionTitle, { color: theme.colors.text }]}>
                    Enter Code Manually
                  </Text>
                  <View style={[styles.badgePill, { backgroundColor: theme.colors.bgGlass, borderWidth: 1, borderColor: theme.colors.border }]}>
                    <Text style={[styles.badgePillText, { color: theme.colors.textMuted }]}>KEYPAD</Text>
                  </View>
                </View>
                <Text style={[styles.actionSubtitle, { color: theme.colors.textMuted }]}>
                  Type in the 8 to 14-digit barcode numbers
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Cancel Button */}
          <Pressable
            testID="add-options-cancel-btn"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={({ pressed }) => [
              styles.cancelButton,
              {
                backgroundColor: pressed
                  ? theme.colors.border
                  : theme.scheme === 'dark'
                    ? theme.colors.bgGlass
                    : '#F0F0ED',
              },
            ]}
          >
            <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 44, 40, 0.45)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handlePill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0CC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
    marginBottom: 18,
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#D6F0E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1.5,
    gap: 14,
  },
  primaryCard: {
    shadowColor: '#4BAE8A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  secondaryCard: {
    borderWidth: 1,
  },
  actionIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTextCol: {
    flex: 1,
    gap: 3,
  },
  actionTitle: {
    fontSize: 15.5,
    fontWeight: '700',
  },
  actionSubtitle: {
    fontSize: 12,
    lineHeight: 16,
  },
  badgePill: {
    backgroundColor: '#4BAE8A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionChevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
