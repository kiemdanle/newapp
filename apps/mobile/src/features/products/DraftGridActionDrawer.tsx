import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ProductDraftRow } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';

export interface DraftGridActionDrawerProps {
  item: ProductDraftRow;
  onEdit: (item: ProductDraftRow) => void;
  onAddToPantry?: (item: ProductDraftRow) => void;
  onDelete?: (item: ProductDraftRow) => void;
  onClose: () => void;
  canDelete?: boolean;
  canAddToPantry?: boolean;
  isProcessing?: boolean;
}

export function DraftGridActionDrawer({
  item,
  onEdit,
  onAddToPantry,
  onDelete,
  onClose,
  canDelete = item.status === 'draft' || item.status === 'changes_required',
  canAddToPantry = item.status === 'active' || item.status === 'pending',
  isProcessing = false,
}: DraftGridActionDrawerProps) {
  const theme = useTheme();

  return (
    <View
      testID={`draft-grid-action-drawer-${item.id}`}
      style={[
        styles.drawerContainer,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Header with Draft Name & Close Button */}
      <View style={styles.headerRow}>
        <Text
          numberOfLines={1}
          style={[styles.headerTitle, { color: theme.colors.textMuted }]}
        >
          {item.name || 'Draft item'}
        </Text>
        <Pressable
          testID={`draft-close-actions-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Close actions for ${item.name}`}
          onPress={onClose}
          hitSlop={14}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={18} color={theme.colors.textMuted} />
        </Pressable>
      </View>

      {/* Floating Action Circles */}
      <View style={styles.actionsColumn}>
        {/* Edit Action */}
        <View style={styles.actionItemWrap}>
          <Pressable
            testID={`draft-grid-action-edit-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            disabled={isProcessing}
            onPress={() => {
              if (!isProcessing) {
                onClose();
                onEdit(item);
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
            <Ionicons name="create-outline" size={22} color={theme.colors.neutralDark} />
          </Pressable>
          <Text style={[styles.actionLabel, { color: theme.colors.textMuted }]}>
            Edit
          </Text>
        </View>

        {/* Add to Pantry Action (Guarded: active & pending only) */}
        {canAddToPantry && onAddToPantry ? (
          <View style={styles.actionItemWrap}>
            <Pressable
              testID={`draft-grid-action-add-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name} to pantry`}
              disabled={isProcessing}
              onPress={() => {
                if (!isProcessing) {
                  onClose();
                  onAddToPantry(item);
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
              <Ionicons name="basket-outline" size={22} color={theme.colors.neutralDark} />
            </Pressable>
            <Text style={[styles.actionLabel, { color: theme.colors.textMuted }]}>
              Add
            </Text>
          </View>
        ) : null}

        {/* Delete Action (Guarded: draft & changes_required only) */}
        {canDelete && onDelete ? (
          <View style={styles.actionItemWrap}>
            <Pressable
              testID={`draft-grid-action-delete-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name}`}
              disabled={isProcessing}
              onPress={() => {
                if (!isProcessing) {
                  onClose();
                  onDelete(item);
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
              <Ionicons name="trash-outline" size={22} color="#FFFFFF" />
            </Pressable>
            <Text style={[styles.actionLabel, { color: theme.colors.textMuted }]}>
              Delete
            </Text>
          </View>
        ) : null}
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
  actionsColumn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 4,
  },
  actionItemWrap: {
    alignItems: 'center',
    gap: 4,
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
