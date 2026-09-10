import React, { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ProductDraftRow, ProductDraftStatus } from '@expyrico/shared';
import { PrivateProductImage } from '../../api/product-private-image';
import { useTheme } from '../../theme/useTheme';
import { formatDate } from '../../utils/country-format';

export interface DraftSwipeableRowProps {
  item: ProductDraftRow;
  onPress: (item: ProductDraftRow) => void;
  onEdit: (item: ProductDraftRow) => void;
  onAddToPantry?: (item: ProductDraftRow) => void;
  onDelete?: (item: ProductDraftRow) => void;
  onSwipeableWillOpen?: (ref: Swipeable) => void;
  isSubmitting?: boolean;
}

const STATUS_CONFIG: Partial<Record<ProductDraftStatus, { label: string; text: string; bg: string }>> = {
  pending: { label: 'Awaiting review', text: '#8C8C85', bg: '#F0F0ED' },
  draft: { label: 'Draft', text: '#8C8C85', bg: '#F0F0ED' },
  changes_required: { label: 'Changes requested', text: '#2C2C28', bg: '#FEEFC3' },
};

function formatUpdatedAt(iso: string): string {
  return formatDate(iso, null, { style: 'medium' });
}

export function DraftSwipeableRow({
  item,
  onPress,
  onEdit,
  onAddToPantry,
  onDelete,
  onSwipeableWillOpen,
  isSubmitting,
}: DraftSwipeableRowProps) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const statusCfg = STATUS_CONFIG[item.status];
  const [rowWidth, setRowWidth] = useState(0);

  const canDelete = true;
  const canAddToPantry = true;

  const renderRightActions = () => {
    return (
      <View
        style={[
          styles.actionDrawer,
          {
            width: rowWidth > 0 ? rowWidth : '100%',
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {/* Left Side: Product thumbnail + Name + Status */}
        <Pressable
          style={styles.drawerLeft}
          onPress={() => {
            swipeableRef.current?.close();
            onPress(item);
          }}
        >
          {item.cover ? (
            item.cover.thumbnailUrl.startsWith('http') ? (
              <Image
                source={{ uri: item.cover.thumbnailUrl }}
                style={{ width: 40, height: 40, borderRadius: theme.radii.sm }}
              />
            ) : (
              <PrivateProductImage
                target={{ kind: 'draft', productId: item.id }}
                photoId={item.cover.photoId}
                style={{ width: 40, height: 40, borderRadius: theme.radii.sm }}
                variant="thumb"
              />
            )
          ) : (
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.bg,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Ionicons name="cube-outline" size={20} color={theme.colors.textMuted} />
            </View>
          )}

          <View style={{ flex: 1, gap: 2 }}>
            <Text
              testID={`draft-drawer-title-${item.id}`}
              style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13 }}
              numberOfLines={1}
            >
              {item.name} · Actions
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 11 }} numberOfLines={1}>
              {statusCfg ? `Status: ${statusCfg.label}` : `Updated ${formatUpdatedAt(item.updatedAt)}`}
            </Text>
          </View>
        </Pressable>

        {/* Right Side: Edit, Add, Delete actions */}
        <View style={styles.drawerRightActions}>
          <Pressable
            testID={`draft-swipe-edit-${item.id}`}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            onPress={() => {
              swipeableRef.current?.close();
              onEdit(item);
            }}
            style={[styles.actionBtn, { backgroundColor: theme.colors.accent }]}
          >
            <Ionicons name="create-outline" size={18} color={theme.colors.neutralDark} />
            <Text style={[styles.actionBtnText, { color: theme.colors.neutralDark }]}>Edit</Text>
          </Pressable>

          {canAddToPantry && onAddToPantry ? (
            <Pressable
              testID={`draft-swipe-add-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Add ${item.name} to pantry`}
              onPress={() => {
                swipeableRef.current?.close();
                onAddToPantry(item);
              }}
              style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
              disabled={isSubmitting}
            >
              <Ionicons name="basket-outline" size={18} color={theme.colors.neutralDark} />
              <Text style={[styles.actionBtnText, { color: theme.colors.neutralDark }]}>Add</Text>
            </Pressable>
          ) : null}

          {canDelete && onDelete ? (
            <Pressable
              testID={`draft-swipe-delete-${item.id}`}
              accessibilityRole="button"
              accessibilityLabel={`Delete ${item.name}`}
              onPress={() => {
                swipeableRef.current?.close();
                onDelete(item);
              }}
              style={[styles.actionBtn, { backgroundColor: theme.colors.danger }]}
              disabled={isSubmitting}
            >
              <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        if (width > 0) setRowWidth(width);
      }}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={1}
        rightThreshold={35}
        overshootRight={false}
        onSwipeableWillOpen={() => {
          if (swipeableRef.current && onSwipeableWillOpen) {
            onSwipeableWillOpen(swipeableRef.current);
          }
        }}
      >
        <Pressable
          testID={`draft-row-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={statusCfg ? `${item.name}, ${statusCfg.label}` : item.name}
          onPress={() => onPress(item)}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.md,
            padding: theme.spacing.md,
            borderRadius: theme.radii.md,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
          })}
        >
          {item.cover ? (
            item.cover.thumbnailUrl.startsWith('http') ? (
              <Image
                testID="draft-row-cover"
                source={{ uri: item.cover.thumbnailUrl }}
                style={{ width: 48, height: 48, borderRadius: theme.radii.sm }}
              />
            ) : (
              <PrivateProductImage
                testID="draft-row-cover"
                target={{ kind: 'draft', productId: item.id }}
                photoId={item.cover.photoId}
                style={{ width: 48, height: 48, borderRadius: theme.radii.sm }}
                variant="thumb"
              />
            )
          ) : (
            <View
              testID="draft-row-cover-placeholder"
              style={{
                width: 48,
                height: 48,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.bg,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1,
                borderColor: theme.colors.border,
              }}
            >
              <Ionicons name="cube-outline" size={24} color={theme.colors.textMuted} />
            </View>
          )}

          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: theme.colors.text, fontWeight: '600' }} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
              Updated {formatUpdatedAt(item.updatedAt)}
            </Text>
            {item.status === 'changes_required' && item.moderationFeedback ? (
              <Text style={{ color: theme.colors.danger, fontSize: 12 }} numberOfLines={1}>
                {item.moderationFeedback}
              </Text>
            ) : null}
          </View>

          {statusCfg ? (
            <View style={{ backgroundColor: statusCfg.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: theme.radii.sm }}>
              <Text style={{ color: statusCfg.text, fontSize: 11, fontWeight: '700' }}>
                {statusCfg.label}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
    borderRadius: 16,
  },
  actionDrawer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  drawerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingRight: 8,
    height: '100%',
  },
  drawerRightActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    height: '100%',
  },
  actionBtn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 2,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
});
