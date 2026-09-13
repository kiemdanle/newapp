import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { LocalRecord } from '../../api/records';
import { useProduct } from '../../api/products';
import { useTheme } from '../../theme/useTheme';

export interface PantryGridActionDrawerProps {
  record: LocalRecord;
  onUsed?: (record: LocalRecord) => void;
  onDuplicate?: (record: LocalRecord) => void;
  onEdit?: (record: LocalRecord) => void;
  onDiscard?: (record: LocalRecord) => void;
  onDelete?: (record: LocalRecord) => void;
  onClose: () => void;
  canDelete?: boolean;
  isProcessing?: boolean;
}

export function PantryGridActionDrawer({
  record,
  onUsed,
  onDuplicate,
  onEdit,
  onDiscard,
  onDelete,
  onClose,
  canDelete = true,
  isProcessing = false,
}: PantryGridActionDrawerProps) {
  const theme = useTheme();
  const { data: product } = useProduct(record.productId ?? undefined);
  const displayName = record.customName || product?.name || 'Item';

  return (
    <View
      testID={`pantry-grid-action-drawer-${record.id}`}
      style={[
        styles.drawerContainer,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Header with Product Name & Close Button */}
      <View style={styles.headerRow}>
        <Text
          numberOfLines={1}
          style={[styles.headerTitle, { color: theme.colors.textMuted }]}
        >
          {displayName}
        </Text>
        <Pressable
          testID={`record-close-actions-${record.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Close actions for ${displayName}`}
          onPress={onClose}
          hitSlop={8}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {/* 2x2 Floating Action Grid */}
      <View style={styles.actionsGrid}>
        {/* Row 1: Used & Edit */}
        <View style={styles.actionGridRow}>
          {/* Used */}
          <View style={styles.actionItemWrap}>
            <Pressable
              testID={`record-used-${record.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Mark ${displayName} as used`}
              disabled={isProcessing}
              onPress={() => {
                if (!isProcessing) {
                  onUsed?.(record);
                }
              }}
              style={({ pressed }) => [
                styles.actionCircle,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed || isProcessing ? 0.82 : 1,
                },
              ]}
            >
              <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.actionLabel, { color: theme.colors.textMuted }]}>
              Used
            </Text>
          </View>

          {/* Edit */}
          <View style={styles.actionItemWrap}>
            <Pressable
              testID={`record-edit-${record.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${displayName}`}
              disabled={isProcessing}
              onPress={() => {
                if (!isProcessing) {
                  onEdit?.(record);
                }
              }}
              style={({ pressed }) => [
                styles.actionCircle,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: pressed || isProcessing ? 0.82 : 1,
                },
              ]}
            >
              <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.actionLabel, { color: theme.colors.textMuted }]}>
              Edit
            </Text>
          </View>
        </View>

        {/* Row 2: Duplicate & Discard */}
        <View style={styles.actionGridRow}>
          {/* Duplicate */}
          <View style={styles.actionItemWrap}>
            <Pressable
              testID={`record-duplicate-${record.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Duplicate ${displayName}`}
              disabled={isProcessing}
              onPress={() => {
                if (!isProcessing) {
                  onDuplicate?.(record);
                }
              }}
              style={({ pressed }) => [
                styles.actionCircle,
                {
                  backgroundColor: theme.colors.utility,
                  opacity: pressed || isProcessing ? 0.82 : 1,
                },
              ]}
            >
              <Ionicons name="copy-outline" size={20} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.actionLabel, { color: theme.colors.textMuted }]}>
              Duplicate
            </Text>
          </View>

          {/* Discard / Delete */}
          {canDelete ? (
            <View style={styles.actionItemWrap}>
              <Pressable
                testID={`record-delete-${record.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Discard ${displayName}`}
                disabled={isProcessing}
                onPress={() => {
                  if (!isProcessing) {
                    (onDiscard || onDelete)?.(record);
                  }
                }}
                style={({ pressed }) => [
                  styles.actionCircle,
                  {
                    backgroundColor: theme.colors.danger,
                    opacity: pressed || isProcessing ? 0.82 : 1,
                  },
                ]}
              >
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              </Pressable>
              <Text style={[styles.actionLabel, { color: theme.colors.textMuted }]}>
                Discard
              </Text>
            </View>
          ) : (
            <View style={styles.actionItemWrap}>
              <View
                style={[
                  styles.actionCircle,
                  {
                    backgroundColor: theme.colors.bgGlass,
                    borderColor: theme.colors.border,
                    borderWidth: 1,
                    opacity: 0.4,
                  },
                ]}
              >
                <Ionicons name="lock-closed-outline" size={18} color={theme.colors.textMuted} />
              </View>
              <Text style={[styles.actionLabel, { color: theme.colors.textMuted, opacity: 0.6 }]}>
                Shared
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawerContainer: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    marginBottom: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  closeBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  actionsGrid: {
    flex: 1,
    justifyContent: 'space-evenly',
    gap: 6,
  },
  actionGridRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  actionItemWrap: {
    alignItems: 'center',
    gap: 2,
    width: 58,
  },
  actionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
