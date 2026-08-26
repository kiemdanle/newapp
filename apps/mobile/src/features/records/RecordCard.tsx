import React, { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { LocalRecord } from '../../api/records';
import { useProduct } from '../../api/products';
import { useTheme } from '../../theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from './expiryStatus';

interface Props {
  record: LocalRecord;
  onPress: () => void;
  addedByName?: string | null;
  onAddQuantity?: (record: LocalRecord) => void;
  onEdit?: (record: LocalRecord) => void;
  onDelete?: (record: LocalRecord) => void;
}

export function RecordCard({ record, onPress, addedByName, onAddQuantity, onEdit, onDelete }: Props) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const { data: product } = useProduct(record.productId ?? undefined);

  const displayName = record.customName || product?.name || 'Item';
  const brand = product?.brand;
  const category = record.category || product?.category;
  const imageUrl = record.photoUrl || product?.imageUrl || (product?.photos && (product.photos[0]?.displayUrl || product.photos[0]?.thumbnailUrl)) || null;

  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  const statusBg = status === 'amber'
    ? theme.colors.accentLight
    : status === 'red'
      ? theme.colors.bgGlass
      : theme.colors.primaryLight;

  const renderRightActions = (
    _progress: Animated.AnimatedInterpolation<number>,
    _dragX: Animated.AnimatedInterpolation<number>,
  ) => {
    return (
      <View style={styles.rightActionsRow}>
        {/* Quick +1 Quantity */}
        <Pressable
          testID={`record-add-quantity-${record.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Add 1 to ${displayName}`}
          onPress={() => {
            swipeableRef.current?.close();
            onAddQuantity?.(record);
          }}
          style={[styles.actionBtn, { backgroundColor: theme.colors.primary }]}
        >
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>+1</Text>
        </Pressable>

        {/* Quick Edit */}
        <Pressable
          testID={`record-edit-${record.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${displayName}`}
          onPress={() => {
            swipeableRef.current?.close();
            onEdit?.(record);
          }}
          style={[styles.actionBtn, { backgroundColor: theme.colors.accent }]}
        >
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Edit</Text>
        </Pressable>

        {/* Quick Delete */}
        <Pressable
          testID={`record-delete-${record.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${displayName}`}
          onPress={() => {
            swipeableRef.current?.close();
            onDelete?.(record);
          }}
          style={[styles.actionBtn, { backgroundColor: theme.colors.danger }]}
        >
          <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
          <Text style={styles.actionBtnText}>Delete</Text>
        </Pressable>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={1}
      rightThreshold={35}
      containerStyle={styles.cardContainer}
    >
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        testID={`record-card-${record.id}`}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.bgElevated,
            overflow: 'hidden',
            opacity: pressed ? 0.88 : 1,
            shadowColor: theme.colors.neutralDark,
            shadowOpacity: 0.05,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          },
        ]}
      >
        {/* Status edge bar */}
        <View testID={`record-expiry-status-${status}`} style={{ width: 4, backgroundColor: statusColor }} />

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
          {/* Product Image Thumbnail */}
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={{
                width: 52,
                height: 52,
                borderRadius: theme.radii.sm,
                marginRight: theme.spacing.md,
                backgroundColor: theme.colors.neutralLight,
              }}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: theme.radii.sm,
                marginRight: theme.spacing.md,
                backgroundColor: theme.colors.neutralLight,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="nutrition-outline" size={24} color={theme.colors.textMuted} />
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                {brand ? (
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 11,
                      fontWeight: '700',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      marginBottom: 1,
                    }}
                    numberOfLines={1}
                  >
                    {brand}
                  </Text>
                ) : category ? (
                  <Text
                    style={{
                      color: theme.colors.textMuted,
                      fontSize: 11,
                      fontWeight: '600',
                      textTransform: 'capitalize',
                      letterSpacing: 0.3,
                      marginBottom: 1,
                    }}
                    numberOfLines={1}
                  >
                    {category}
                  </Text>
                ) : null}
                <Text
                  style={{ color: theme.colors.text, fontWeight: '600', fontSize: 15 }}
                  numberOfLines={2}
                >
                  {displayName}
                </Text>
              </View>
              <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600' }}>
                  {record.quantity} {record.unit}
                </Text>
              </View>
            </View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
              Expires {record.expiryDate}
            </Text>
            {addedByName ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 3 }}>
                added by {addedByName}
              </Text>
            ) : null}
          </View>
        </View>
      </Pressable>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rightActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 10,
    marginLeft: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionBtn: {
    width: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
