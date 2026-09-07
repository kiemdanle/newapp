// apps/mobile/src/features/records/HistoryRecordCard.tsx
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { LocalRecord } from '../../api/records';
import { useProduct } from '../../api/products';
import { useTheme } from '../../theme/useTheme';
import { formatDate } from '../../utils/country-format';
import { ProductThumbnail } from '../../components/ProductThumbnail';

export interface HistoryRecordCardProps {
  record: LocalRecord;
  onRestore: (record: LocalRecord) => void;
  onPress: (id: string) => void;
  userCountry: string | null;
}

export function HistoryRecordCard({
  record,
  onRestore,
  onPress,
  userCountry,
}: HistoryRecordCardProps) {
  const theme = useTheme();
  const { data: product } = useProduct(record.productId ?? undefined);
  const displayName = record.customName || product?.name || 'Pantry Item';
  const category = record.category || product?.category;
  const isConsumed = record.status === 'consumed';

  const actionDate = isConsumed ? record.consumedAt : record.discardedAt;
  const formattedActionDate = actionDate
    ? formatDate(actionDate.slice(0, 10), userCountry)
    : null;

  return (
    <Pressable
      testID={`history-card-${record.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${isConsumed ? 'used' : 'discarded'}`}
      onPress={() => onPress(record.id)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={styles.cardMain}>
        <ProductThumbnail
          product={product}
          photoUrl={record.photoUrl}
          size={56}
          fallbackIcon={isConsumed ? 'checkmark-circle-outline' : 'trash-outline'}
          style={styles.thumbnail}
        />

        <View style={styles.cardContent}>
          <View style={styles.titleRow}>
            <Text style={[styles.itemTitle, { color: theme.colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
          </View>

          <Text style={[styles.itemSubtitle, { color: theme.colors.textMuted }]}>
            {record.quantity} {record.unit}
            {category ? ` · ${category}` : ''}
          </Text>

          {/* Status & Date Badges */}
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isConsumed
                    ? 'rgba(75, 174, 138, 0.12)'
                    : 'rgba(245, 166, 35, 0.14)',
                },
              ]}
            >
              <Ionicons
                name={isConsumed ? 'checkmark-circle' : 'trash'}
                size={13}
                color={isConsumed ? '#4BAE8A' : '#F5A623'}
              />
              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isConsumed ? '#3A8F6F' : '#B8740B' },
                ]}
              >
                {isConsumed ? 'Used' : 'Discarded'}
                {formattedActionDate ? ` ${formattedActionDate}` : ''}
              </Text>
            </View>

            {record.discardReason ? (
              <View
                style={[
                  styles.reasonBadge,
                  { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.reasonBadgeText, { color: theme.colors.textMuted }]}>
                  {record.discardReason.charAt(0).toUpperCase() + record.discardReason.slice(1)}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Restore Button */}
      <View style={styles.cardFooter}>
        <Text style={[styles.expiryMeta, { color: theme.colors.textMuted }]}>
          Exp: {formatDate(record.expiryDate, userCountry)}
        </Text>
        <Pressable
          testID={`history-restore-${record.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Restore ${displayName} to active pantry`}
          onPress={() => onRestore(record)}
          style={({ pressed }) => [
            styles.restoreBtn,
            {
              backgroundColor: pressed ? theme.colors.primaryLight : 'rgba(75, 174, 138, 0.1)',
              borderColor: '#4BAE8A',
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Ionicons name="refresh-outline" size={14} color="#3A8F6F" />
          <Text style={styles.restoreBtnText}>Restore to Pantry</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minHeight: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbnail: {
    borderRadius: 12,
  },
  cardContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  itemSubtitle: {
    fontSize: 13,
    marginBottom: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reasonBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  reasonBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  expiryMeta: {
    fontSize: 12,
  },
  restoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
  },
  restoreBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3A8F6F',
  },
});
