import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ProductDraftRow, ProductDraftStatus } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';
import { PrivateProductImage } from '../../api/product-private-image';
import { formatDate } from '../../utils/country-format';
import { DraftGridActionDrawer } from './DraftGridActionDrawer';
import { SkeletonBone, SkeletonShimmer } from '../../components/skeleton';
export interface DraftGridCardProps {
  item: ProductDraftRow;
  onPress: (item: ProductDraftRow) => void;
  onEdit?: (item: ProductDraftRow) => void;
  onAddPress?: (item: ProductDraftRow) => void;
  onDelete?: (item: ProductDraftRow) => void;
  onSwipeableWillOpen?: (ref: Swipeable) => void;
  isSubmitting?: boolean;
  isLoading?: boolean;
}

const STATUS_CONFIG: Partial<Record<ProductDraftStatus, { label: string; text: string; bg: string }>> = {
  pending: { label: 'Awaiting review', text: '#8C8C85', bg: '#F0F0ED' },
  draft: { label: 'Draft', text: '#8C8C85', bg: '#F0F0ED' },
  changes_required: { label: 'Changes requested', text: '#2C2C28', bg: '#FEEFC3' },
};

function formatUpdatedAt(iso: string): string {
  return formatDate(iso, null, { style: 'short' });
}

export function DraftGridCard({
  item,
  onPress,
  onEdit,
  onAddPress,
  onDelete,
  onSwipeableWillOpen,
  isSubmitting,
  isLoading = false,
}: DraftGridCardProps) {
  const theme = useTheme();
  const swipeableRef = useRef<Swipeable>(null);
  const [cardWidth, setCardWidth] = useState(0);

  const statusCfg = STATUS_CONFIG[item.status];
  const canAddDirectly = true;
  const isBarcode = item.identifier.kind === 'barcode';
  const identifierValue = item.identifier.value;

  const renderRightActions = () => (
    <View
      style={[
        styles.actionDrawerWrapper,
        { width: cardWidth > 0 ? cardWidth : 160 },
      ]}
    >
      <DraftGridActionDrawer
        item={item}
        onEdit={onEdit ?? onPress}
        onAddToPantry={onAddPress}
        onDelete={onDelete}
        onClose={() => swipeableRef.current?.close()}
        isProcessing={isSubmitting}
      />
    </View>
  );

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { width } = e.nativeEvent.layout;
        if (width > 0) setCardWidth(width);
      }}
    >
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        friction={1}
        overshootRight={false}
        rightThreshold={30}
        onSwipeableWillOpen={() => {
          if (swipeableRef.current && onSwipeableWillOpen) {
            onSwipeableWillOpen(swipeableRef.current);
          }
        }}
      >
        <Pressable
          testID={`draft-grid-card-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={statusCfg ? `${item.name}, ${statusCfg.label}` : item.name}
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
      {isLoading ? (
        <View style={styles.topRow}>
          <SkeletonShimmer>
            <SkeletonBone
              testID="draft-grid-status-skeleton"
              width={65}
              height={18}
              borderRadius={theme.radii.sm}
            />
          </SkeletonShimmer>
        </View>
      ) : statusCfg ? (
        <View style={styles.topRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
            <Text style={[styles.statusBadgeText, { color: statusCfg.text }]} numberOfLines={1}>
              {statusCfg.label}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Center Product Image */}
      <View style={styles.imageWrapper}>
        {isLoading ? (
          <View
            testID="draft-grid-thumbnail-skeleton"
            style={[
              styles.thumbnail,
              styles.placeholder,
              {
                backgroundColor: theme.colors.neutralLight,
                borderColor: theme.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: theme.colors.bgGlass,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ActivityIndicator size="small" color={theme.colors.primary} />
            </View>
          </View>
        ) : item.cover ? (
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
      {isLoading ? (
        <SkeletonShimmer style={{ gap: 4, marginVertical: 4 }}>
          <SkeletonBone
            testID="draft-grid-title-skeleton"
            width="80%"
            height={14}
            borderRadius={3}
          />
          <SkeletonBone width="50%" height={14} borderRadius={3} />
        </SkeletonShimmer>
      ) : (
        <Text
          style={[styles.title, { color: theme.colors.text }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
      )}

      {/* Barcode & Meta */}
      {isLoading ? (
        <SkeletonShimmer style={styles.metaRow}>
          <SkeletonBone width="45%" height={11} borderRadius={3} />
        </SkeletonShimmer>
      ) : (
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
      )}

      {/* Direct Add Action Button */}
      {isLoading ? (
        <SkeletonShimmer>
          <SkeletonBone width="100%" height={28} borderRadius={theme.radii.sm} />
        </SkeletonShimmer>
      ) : canAddDirectly ? (
        <Pressable
          testID={`draft-grid-add-btn-${item.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.name} to stash`}
          onPress={(e) => {
            e?.stopPropagation?.();
            onAddPress?.(item);
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
          <Text style={styles.addBtnText}>Add to Stash</Text>
        </Pressable>
      ) : (
        <View style={styles.draftEditNotice}>
          <Text style={[styles.draftEditNoticeText, { color: theme.colors.textMuted }]}>
            Tap to edit details
          </Text>
        </View>
      )}
        </Pressable>
      </Swipeable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    margin: 5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionDrawerWrapper: {
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    flex: 1,
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
