import React, { useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { LocalRecord } from '../../api/records';
import { useProduct } from '../../api/products';
import { useSessionStore } from '../../auth/session-store';
import { useTheme } from '../../theme/useTheme';
import { formatDate } from '../../utils/country-format';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from './expiryStatus';
import { ProductThumbnail } from '../../components/ProductThumbnail';
import { usePantryScope } from '../../store/pantryScope';
interface Props {
  record: LocalRecord;
  onPress: () => void;
  householdName?: string | null;
  showHouseholdBadge?: boolean;
  addedByName?: string | null;
  onAddQuantity?: (record: LocalRecord) => void;
  onEdit?: (record: LocalRecord) => void;
  onDelete?: (record: LocalRecord) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
}
export function RecordCard({
  record,
  onPress,
  householdName,
  showHouseholdBadge,
  addedByName,
  onAddQuantity,
  onEdit,
  onDelete,
  selectionMode = false,
  isSelected = false,
  onLongPress,
  onToggleSelect,
}: Props) {
  const theme = useTheme();
  const { scope } = usePantryScope();
  const userCountry = useSessionStore((s) => s.user?.country ?? null);
  const swipeableRef = useRef<Swipeable>(null);
  const { data: product } = useProduct(record.productId ?? undefined);
  const displayName = record.customName || product?.name || 'Item';
  const brand = product?.brand;
  const category = record.category || product?.category;
  const imageUrl = record.photoUrl || product?.imageUrl || (product?.photos && (product.photos[0]?.displayUrl || product.photos[0]?.thumbnailUrl)) || null;

  const isHouseholdItem =
    showHouseholdBadge ?? (scope === 'all' && Boolean(record.householdId));
  const badgeLabel = householdName || 'Shared';

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
      enabled={!selectionMode}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={1}
      rightThreshold={35}
      containerStyle={styles.cardContainer}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${displayName}${isHouseholdItem ? `, Shared in ${badgeLabel}` : ''}, Expires ${formatDate(record.expiryDate, userCountry)}`}
        onPress={selectionMode ? onToggleSelect : onPress}
        onLongPress={selectionMode ? undefined : onLongPress}
        delayLongPress={300}
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
        {selectionMode && (
          <View
            testID={`record-select-checkbox-${record.id}`}
            style={{
              paddingLeft: theme.spacing.md,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
              size={22}
              color={isSelected ? theme.colors.primary : theme.colors.border}
            />
          </View>
        )}

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', padding: theme.spacing.md }}>
          {/* Product Image Thumbnail */}
          <ProductThumbnail
            product={product}
            photoUrl={record.photoUrl}
            size={52}
            style={{
              width: 52,
              height: 52,
              borderRadius: theme.radii.sm,
              marginRight: theme.spacing.md,
            }}
          />

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
                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                  <Text
                    style={{ color: theme.colors.text, fontWeight: '600', fontSize: 15 }}
                    numberOfLines={2}
                  >
                    {displayName}
                  </Text>
                  {isHouseholdItem && (
                    <View
                      testID={`record-household-badge-${record.id}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                        backgroundColor: theme.colors.primaryLight,
                        borderColor: 'rgba(75, 174, 138, 0.3)',
                        borderWidth: 1,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: theme.radii.pill,
                        maxWidth: 120,
                      }}
                    >
                      <Ionicons name="people-outline" size={11} color={theme.colors.primaryDark} />
                      <Text
                        numberOfLines={1}
                        ellipsizeMode="tail"
                        style={{
                          color: theme.colors.primaryDark,
                          fontSize: 10,
                          fontWeight: '700',
                        }}
                      >
                        {badgeLabel}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600' }}>
                  {record.quantity} {record.unit}
                </Text>
              </View>
            </View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
              Expires {formatDate(record.expiryDate, userCountry)}
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
