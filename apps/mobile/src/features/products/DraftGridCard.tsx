import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ProductDraftRow, ProductDraftStatus } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';
import { PrivateProductImage } from '../../api/product-private-image';
import { formatDate } from '../../utils/country-format';

export interface DraftGridCardProps {
  item: ProductDraftRow;
  onPress: (item: ProductDraftRow) => void;
  onAddPress: (item: ProductDraftRow) => void;
  isSubmitting?: boolean;
}

const STATUS_CONFIG: Record<ProductDraftStatus, { label: string; text: string; bg: string }> = {
  active: { label: 'Catalog Active', text: '#3A8F6F', bg: '#D6F0E6' },
  pending: { label: 'Awaiting review', text: '#B45309', bg: '#FEEFC3' },
  draft: { label: 'Draft', text: '#8C8C85', bg: '#F0F0ED' },
  changes_required: { label: 'Changes requested', text: '#E0442A', bg: '#FDE8E8' },
};

function formatUpdatedAt(iso: string): string {
  return formatDate(iso, null, { style: 'short' });
}

export function DraftGridCard({
  item,
  onPress,
  onAddPress,
  isSubmitting,
}: DraftGridCardProps) {
  const theme = useTheme();
  const statusCfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
  const canAddDirectly = item.status === 'active' || item.status === 'pending';
  const isBarcode = item.identifier.kind === 'barcode';
  const identifierValue = item.identifier.value;

  return (
    <Pressable
      testID={`draft-grid-card-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${statusCfg.label}`}
      onPress={() => onPress(item)}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
        },
      ]}
    >
      {/* Top Header Row: Status Badge */}
      <View style={styles.topRow}>
        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
          <Text style={[styles.statusBadgeText, { color: statusCfg.text }]} numberOfLines={1}>
            {statusCfg.label}
          </Text>
        </View>
      </View>

      {/* Center Product Image */}
      <View style={styles.imageWrapper}>
        {item.cover ? (
          item.cover.thumbnailUrl.startsWith('http') ? (
            <Image
              testID="draft-grid-cover"
              source={{ uri: item.cover.thumbnailUrl }}
              style={[styles.thumbnail, { borderColor: theme.colors.border }]}
            />
          ) : (
            <PrivateProductImage
              testID="draft-grid-cover"
              target={{ kind: 'draft', productId: item.id }}
              photoId={item.cover.photoId}
              variant="thumb"
              style={[styles.thumbnail, { borderColor: theme.colors.border }]}
            />
          )
        ) : (
          <View
            testID="draft-grid-cover-placeholder"
            style={[
              styles.thumbnail,
              styles.placeholder,
              { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
            ]}
          >
            <Ionicons name="cube-outline" size={32} color={theme.colors.textMuted} />
          </View>
        )}
      </View>

      {/* Product Title */}
      <Text
        style={[styles.title, { color: theme.colors.text }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>

      {/* Barcode & Meta */}
      <View style={styles.metaRow}>
        {identifierValue ? (
          <View style={styles.identifierRow}>
            <Ionicons
              name={isBarcode ? 'barcode-outline' : 'qr-code-outline'}
              size={12}
              color={theme.colors.textMuted}
            />
            <Text style={[styles.identifierText, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {identifierValue}
            </Text>
          </View>
        ) : null}
        <Text style={[styles.updatedAt, { color: theme.colors.textMuted }]}>
          {formatUpdatedAt(item.updatedAt)}
        </Text>
      </View>

      {/* Direct Add Action Button */}
      {canAddDirectly ? (
        <Pressable
          testID={`draft-grid-add-btn-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name} to pantry`}
          onPress={(e) => {
            e?.stopPropagation?.();
            onAddPress(item);
          }}
          style={({ pressed }) => [
            styles.addBtn,
            {
              backgroundColor: pressed ? '#C7EADB' : '#D6F0E6',
              borderColor: '#4BAE8A',
              opacity: isSubmitting ? 0.6 : 1,
            },
          ]}
          disabled={isSubmitting}
        >
          <Ionicons name="add" size={15} color="#2A6F54" />
          <Text style={styles.addBtnText}>Add to Pantry</Text>
        </Pressable>
      ) : (
        <View style={styles.draftEditNotice}>
          <Text style={[styles.draftEditNoticeText, { color: theme.colors.textMuted }]}>
            Tap to edit details
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    margin: 5,
    borderWidth: 1,
    padding: 12,
    justifyContent: 'space-between',
    minHeight: 230,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  imageWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 13.5,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 6,
    minHeight: 36,
  },
  metaRow: {
    marginTop: 4,
    marginBottom: 8,
    gap: 2,
  },
  identifierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  identifierText: {
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    flex: 1,
  },
  updatedAt: {
    fontSize: 10.5,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 4,
  },
  addBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#2A6F54',
  },
  draftEditNotice: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  draftEditNoticeText: {
    fontSize: 11,
    fontStyle: 'italic',
  },
});
