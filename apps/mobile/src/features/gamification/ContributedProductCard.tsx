import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { CommunityContributionRow } from '@expyrico/shared';
import { PrivateProductImage } from '../../api/product-private-image';
import { useTheme } from '../../theme/useTheme';

export interface ContributedProductCardProps {
  item: CommunityContributionRow;
  onPress?: () => void;
}

const STATUS_CONFIG: Record<
  CommunityContributionRow['status'],
  { label: string; text: string; bg: string }
> = {
  active: { label: 'Catalog Active', text: '#3A8F6F', bg: '#D6F0E6' },
  pending: { label: 'Awaiting review', text: '#8C8C85', bg: '#F0F0ED' },
  changes_required: { label: 'Changes requested', text: '#2C2C28', bg: '#FEEFC3' },
  report_hidden: { label: 'Under review', text: '#8C8C85', bg: '#F0F0ED' },
  merged_into: { label: 'Merged', text: '#8C8C85', bg: '#F0F0ED' },
  draft: { label: 'Draft', text: '#8C8C85', bg: '#F0F0ED' },
};

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

export function ContributedProductCard({ item, onPress }: ContributedProductCardProps) {
  const theme = useTheme();
  const statusConfig = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
  const formattedDate = formatDate(item.createdAt);

  return (
    <Pressable
      testID={`contributed-card-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={
        item.status !== 'active'
          ? `${item.name}, ${statusConfig.label}`
          : item.name
      }
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
          backgroundColor: pressed ? theme.colors.bgGlass : theme.colors.bgElevated,
        },
      ]}
    >
      {/* 48x48 Thumbnail */}
      {item.coverPhotoId ? (
        <PrivateProductImage
          testID="contributed-card-cover"
          target={{ kind: 'draft', productId: item.id }}
          photoId={item.coverPhotoId}
          variant="thumb"
          style={{ width: 48, height: 48, borderRadius: theme.radii.sm }}
          resizeMode="cover"
        />
      ) : item.coverImageUrl ? (
        <Image
          testID="contributed-card-cover"
          source={{ uri: item.coverImageUrl }}
          style={{ width: 48, height: 48, borderRadius: theme.radii.sm }}
          resizeMode="cover"
        />
      ) : (
        <View
          testID="contributed-card-placeholder"
          style={{
            width: 48,
            height: 48,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.bgGlass,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="cube-outline" size={24} color={theme.colors.textMuted} />
        </View>
      )}

      {/* Middle details */}
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={[styles.productName, { color: theme.colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          {item.brand ? (
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }} numberOfLines={1}>
              {item.brand} •{' '}
            </Text>
          ) : null}
          <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
            Added {formattedDate}
          </Text>
        </View>
        {item.barcode ? (
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 11,
              fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
            }}
          >
            {item.barcode}
          </Text>
        ) : null}
      </View>

      {/* Right side: status pill + photo & edit badges */}
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {item.status !== 'active' ? (
          <View
            style={{
              backgroundColor: statusConfig.bg,
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: theme.radii.sm,
            }}
          >
            <Text style={{ color: statusConfig.text, fontSize: 11, fontWeight: '700' }}>
              {statusConfig.label}
            </Text>
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {item.packagingPhotosCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="camera-outline" size={12} color={theme.colors.textMuted} />
              <Text style={{ fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' }}>
                {item.packagingPhotosCount}
              </Text>
            </View>
          )}
          {item.editsCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Ionicons name="create-outline" size={12} color={theme.colors.textMuted} />
              <Text style={{ fontSize: 11, color: theme.colors.textMuted, fontWeight: '600' }}>
                {item.editsCount}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
  },
});
