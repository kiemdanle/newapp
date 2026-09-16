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
  canDelete = true,
  canAddToPantry = true,
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
            <Ionicons name="create-outline" size={20} color={theme.colors.neutralDark} />
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
              <Ionicons name="basket-outline" size={20} color={theme.colors.neutralDark} />
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
              <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
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
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    justifyContent: 'space-between',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 22,
    marginBottom: 2,
  },
  headerTitle: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    marginRight: 4,
  },
  closeBtn: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 11,
  },
  actionsColumn: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 2,
    gap: 4,
  },
  actionItemWrap: {
    alignItems: 'center',
    gap: 2,
    width: '100%',
  },
  actionCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
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
