import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, View } from 'react-native';
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
import { PantryGridActionDrawer } from './PantryGridActionDrawer';

export interface PantryGridCardProps {
  record: LocalRecord;
  onPress: () => void;
  householdName?: string | null;
  showHouseholdBadge?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
  onDuplicate?: (record: LocalRecord) => void;
  onEdit?: (record: LocalRecord) => void;
  onDelete?: (record: LocalRecord, displayName?: string) => void;
  isDrawerOpen?: boolean;
  onOpenDrawer?: () => void;
  onCloseDrawer?: () => void;
}

export function PantryGridCard({
  record,
  onPress,
  householdName,
  showHouseholdBadge,
  selectionMode = false,
  isSelected = false,
  onLongPress,
  onToggleSelect,
  onDuplicate,
  onEdit,
  onDelete,
  isDrawerOpen,
  onOpenDrawer,
  onCloseDrawer,
}: PantryGridCardProps) {
  const theme = useTheme();
  const { scope } = usePantryScope();
  const sessionUser = useSessionStore((s) => s.user);
  const userCountry = sessionUser?.country ?? null;
  const currentUserId = sessionUser?.id ?? null;
  const swipeableRef = useRef<Swipeable>(null);
  const [cardWidth, setCardWidth] = useState(0);
  const isProcessingRef = useRef(false);
  const { data: product } = useProduct(record.productId ?? undefined);

  const displayName = record.customName || product?.name || 'Item';
  const brand = product?.brand;
  const category = record.category || product?.category;

  const isHouseholdItem =
    showHouseholdBadge ?? (scope === 'all' && Boolean(record.householdId));
  const isPersonalItem =
    showHouseholdBadge === undefined ? (scope === 'all' && !record.householdId) : false;
  const badgeLabel = householdName || 'Shared';

  // Creator-only delete permission gate per Red Team Finding 3
  const canDelete = !record.householdId || (Boolean(currentUserId) && record.userId === currentUserId);
  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  const statusBg =
    status === 'amber'
      ? theme.colors.accentLight
      : status === 'red'
        ? theme.colors.bgGlass
        : theme.colors.primaryLight;

  const handleCardLongPress = useCallback(() => {
    if (!selectionMode && onLongPress) {
      onLongPress();
    }
  }, [selectionMode, onLongPress]);

  // Synchronize external isDrawerOpen prop
  useEffect(() => {
    if (isDrawerOpen === false) {
      swipeableRef.current?.close();
    } else if (isDrawerOpen === true) {
      swipeableRef.current?.openRight();
    }
  }, [isDrawerOpen]);

  const handleActionDuplicate = useCallback(
    (rec: LocalRecord) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      swipeableRef.current?.close();
      onCloseDrawer?.();
      onDuplicate?.(rec);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 300);
    },
    [onDuplicate, onCloseDrawer],
  );

  const handleActionEdit = useCallback(
    (rec: LocalRecord) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      swipeableRef.current?.close();
      onCloseDrawer?.();
      onEdit?.(rec);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 300);
    },
    [onEdit, onCloseDrawer],
  );

  const handleActionDelete = useCallback(
    (rec: LocalRecord) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      swipeableRef.current?.close();
      onCloseDrawer?.();
      onDelete?.(rec, displayName);
      setTimeout(() => {
        isProcessingRef.current = false;
      }, 300);
    },
    [onDelete, onCloseDrawer, displayName],
  );

  const handleCloseDrawer = useCallback(() => {
    swipeableRef.current?.close();
    onCloseDrawer?.();
  }, [onCloseDrawer]);

  const handleTriggerOpen = useCallback(
    (e?: GestureResponderEvent) => {
      e?.stopPropagation?.();
      swipeableRef.current?.openRight();
      onOpenDrawer?.();
    },
    [onOpenDrawer],
  );

  const renderRightActions = useCallback(
    () => (
      <View
        style={[
          styles.actionDrawerWrapper,
          { width: cardWidth > 0 ? cardWidth : 160 },
        ]}
        pointerEvents={isDrawerOpen ? 'auto' : 'none'}
        accessibilityElementsHidden={!isDrawerOpen}
        importantForAccessibility={isDrawerOpen ? 'auto' : 'no-hide-descendants'}
      >
        <PantryGridActionDrawer
          record={record}
          onDuplicate={handleActionDuplicate}
          onEdit={handleActionEdit}
          onDelete={handleActionDelete}
          onClose={handleCloseDrawer}
          canDelete={canDelete}
          isProcessing={isProcessingRef.current}
        />
      </View>
    ),
    [
      cardWidth,
      record,
      handleActionDuplicate,
      handleActionEdit,
      handleActionDelete,
      handleCloseDrawer,
      canDelete,
      isDrawerOpen,
    ],
  );

  return (
    <View
      style={styles.cardWrapper}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && w !== cardWidth) {
          setCardWidth(w);
        }
      }}
    >
      <Swipeable
        ref={swipeableRef}
        enabled={!selectionMode}
        renderRightActions={renderRightActions}
        overshootRight={false}
        friction={1}
        rightThreshold={35}
        containerStyle={styles.swipeableContainer}
        onSwipeableWillOpen={onOpenDrawer}
        onSwipeableClose={onCloseDrawer}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${displayName}${isHouseholdItem ? `, Shared in ${badgeLabel}` : ''}, Expires ${formatDate(record.expiryDate, userCountry)}`}
          onPress={selectionMode ? onToggleSelect : onPress}
          onLongPress={onLongPress ? handleCardLongPress : undefined}
          delayLongPress={300}
          testID={`record-card-${record.id}`}
          style={({ pressed }) => [
            styles.pressableCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              opacity: pressed ? 0.88 : 1,
              shadowColor: theme.colors.neutralDark,
            },
          ]}
        >
          <View testID={`pantry-grid-card-${record.id}`} style={styles.contentContainer}>
            {/* Top Row: Checkbox (selection mode) & [••• trigger + Qty Pill] */}
            <View style={styles.topRow}>
              {selectionMode ? (
                <View
                  testID={`record-select-checkbox-${record.id}`}
                  style={styles.checkboxContainer}
                >
                  <Ionicons
                    name={isSelected ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={isSelected ? theme.colors.primary : theme.colors.neutralMid}
                  />
                </View>
              ) : null}

              <View style={styles.topRightCluster}>
                <View
                  testID={`record-expiry-status-${status}`}
                  style={[styles.statusPill, { backgroundColor: statusBg }]}
                >
                  <Text
                    numberOfLines={1}
                    style={[styles.statusPillText, { color: statusColor }]}
                  >
                    {record.quantity} {record.unit}
                  </Text>
                </View>

                {!selectionMode ? (
                  <Pressable
                    testID={`record-open-actions-${record.id}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Open action menu for ${displayName}`}
                    onPress={handleTriggerOpen}
                    hitSlop={8}
                    style={styles.moreBtn}
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color={theme.colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          <View style={styles.thumbnailContainer}>
            <ProductThumbnail
              product={product}
              photoUrl={record.photoUrl}
              size={72}
              style={{
                width: 72,
                height: 72,
                borderRadius: theme.radii.sm,
              }}
            />
          </View>

          {/* Text Area: Brand/Category, Name */}
          <View style={styles.detailsContainer}>
            <View style={styles.brandRow}>
              {brand ? (
                <Text
                  style={[styles.brandText, { color: theme.colors.textMuted }]}
                  numberOfLines={1}
                >
                  {brand}
                </Text>
              ) : category ? (
                <Text
                  style={[styles.categoryText, { color: theme.colors.textMuted }]}
                  numberOfLines={1}
                >
                  {category}
                </Text>
              ) : (
                <View style={styles.brandSpacer} />
              )}
            </View>

            <Text
              style={[
                styles.nameText,
                {
                  color: theme.colors.text,
                },
              ]}
              numberOfLines={2}
            >
              {displayName}
            </Text>
            {/* Footer Metadata: Household/Personal Badge + Expiry Date */}
            <View style={styles.footerMetadata}>
              {isHouseholdItem ? (
                <View
                  testID={`record-household-badge-${record.id}`}
                  style={[
                    styles.householdBadge,
                    {
                      backgroundColor: theme.colors.primaryLight,
                      borderColor: theme.colors.primary,
                      borderRadius: theme.radii.pill,
                    },
                  ]}
                >
                  <Ionicons name="people" size={11} color={theme.colors.primaryDark} />
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[styles.householdBadgeText, { color: theme.colors.primaryDark }]}
                  >
                    {badgeLabel}
                  </Text>
                </View>
              ) : isPersonalItem ? (
                <View
                  testID={`record-personal-badge-${record.id}`}
                  style={[
                    styles.personalBadge,
                    {
                      backgroundColor: theme.colors.bgGlass,
                      borderColor: theme.colors.border,
                      borderRadius: theme.radii.pill,
                    },
                  ]}
                >
                  <Ionicons name="person" size={10} color={theme.colors.textMuted} />
                  <Text
                    style={[
                      styles.personalBadgeText,
                      {
                        color: theme.colors.textMuted,
                      },
                    ]}
                  >
                    Personal
                  </Text>
                </View>
              ) : null}

              <Text style={[styles.expiryText, { color: theme.colors.textMuted }]}>
                Expires {formatDate(record.expiryDate, userCountry)}
              </Text>
            </View>

          </View>
        </View>
          </Pressable>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    flex: 1,
  },
  swipeableContainer: {
    flex: 1,
    borderRadius: 16,
  },
  actionDrawerWrapper: {
    height: '100%',
  },
  topRightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
    flexShrink: 1,
  },
  moreBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  pressableCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  contentContainer: {
    flex: 1,
    padding: 12,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  checkboxContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSpacer: {
    width: 22,
    height: 22,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
    flexShrink: 1,
    maxWidth: 96,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  thumbnailContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  detailsContainer: {
    flex: 1,
    marginTop: 2,
    justifyContent: 'space-between',
  },
  brandRow: {
    minHeight: 16,
    marginBottom: 2,
    justifyContent: 'center',
  },
  brandSpacer: {
    height: 14,
  },
  brandText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  nameText: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 18,
    minHeight: 36,
  },
  footerMetadata: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 'auto',
    paddingTop: 6,
  },
  householdBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    maxWidth: 120,
  },
  householdBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  personalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  personalBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expiryText: {
    fontSize: 12,
  },
});
