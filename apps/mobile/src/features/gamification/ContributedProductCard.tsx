import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { CommunityContributionRow } from '@expyrico/shared';
import { PrivateProductImage } from '../../api/product-private-image';
import { useTheme } from '../../theme/useTheme';

export interface ContributedProductCardProps {
  item: CommunityContributionRow;
  onPress?: () => void;
}

export function ContributedProductCard({ item, onPress }: ContributedProductCardProps) {
  const theme = useTheme();

  const statusConfig = getStatusConfig(item.status);
  const formattedDate = formatDate(item.createdAt);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.bgElevated,
          borderColor: theme.colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
      testID={`contributed-card-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Contribution ${item.name}, status ${statusConfig.label}`}
    >
      {/* Product Thumbnail */}
      <View style={[styles.thumbnailContainer, { backgroundColor: theme.colors.bgGlass }]}>
        {item.coverPhotoId ? (
          <PrivateProductImage
            target={{ kind: 'draft', productId: item.id }}
            photoId={item.coverPhotoId}
            variant="thumb"
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : item.coverImageUrl ? (
          <Image
            source={{ uri: item.coverImageUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <Ionicons name="cube-outline" size={24} color={theme.colors.textMuted} />
        )}
      </View>

      {/* Product Information */}
      <View style={styles.detailsContainer}>
        <View style={styles.topRow}>
          <Text
            style={[styles.productName, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>

          {/* Status Badge */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: `${statusConfig.color}18`, borderColor: `${statusConfig.color}40` },
            ]}
          >
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        {/* Subtitle / Barcode & Brand */}
        <View style={styles.metaRow}>
          {item.brand ? (
            <Text style={[styles.metaText, { color: theme.colors.textMuted }]} numberOfLines={1}>
              {item.brand} •{' '}
            </Text>
          ) : null}
          {item.barcode ? (
            <Text style={[styles.barcodeText, { color: theme.colors.textMuted }]}>
              {item.barcode}
            </Text>
          ) : (
            <Text style={[styles.metaText, { color: theme.colors.textMuted }]}>
              No barcode
            </Text>
          )}
        </View>

        {/* Footer: Date and Extra Contributions */}
        <View style={styles.footerRow}>
          <Text style={[styles.dateText, { color: theme.colors.textMuted }]}>
            Added {formattedDate}
          </Text>

          <View style={styles.statsBadges}>
            {item.packagingPhotosCount > 0 ? (
              <View style={styles.countChip}>
                <Ionicons name="camera-outline" size={12} color={theme.colors.textMuted} />
                <Text style={[styles.countChipText, { color: theme.colors.textMuted }]}>
                  {item.packagingPhotosCount}
                </Text>
              </View>
            ) : null}
            {item.editsCount > 0 ? (
              <View style={styles.countChip}>
                <Ionicons name="create-outline" size={12} color={theme.colors.textMuted} />
                <Text style={[styles.countChipText, { color: theme.colors.textMuted }]}>
                  {item.editsCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function getStatusConfig(status: CommunityContributionRow['status']): {
  label: string;
  color: string;
} {
  switch (status) {
    case 'active':
      return { label: 'Catalog Active', color: '#4BAE8A' }; // Fresh Sage
    case 'pending':
      return { label: 'Awaiting Review', color: '#F5A623' }; // Honey
    case 'changes_required':
      return { label: 'Changes Requested', color: '#E0442A' }; // Alert Red
    case 'report_hidden':
      return { label: 'Under Review', color: '#8C8C85' }; // Pebble
    case 'merged_into':
      return { label: 'Merged', color: '#8C8C85' }; // Pebble
    case 'draft':
    default:
      return { label: 'Draft Template', color: '#F5A623' };
  }
}

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) {
      return 'Recently';
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Recently';
  }
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    marginVertical: 4,
  },
  thumbnailContainer: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  detailsContainer: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  productName: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  metaText: {
    fontSize: 12,
  },
  barcodeText: {
    fontSize: 11,
    fontFamily: 'monospace',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  dateText: {
    fontSize: 11,
  },
  statsBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  countChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
