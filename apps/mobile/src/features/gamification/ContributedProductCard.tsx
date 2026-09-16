import React from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { CommunityContributionRow } from '@expyrico/shared';
import { PrivateProductImage } from '../../api/product-private-image';
import { useTheme } from '../../theme/useTheme';
import { SkeletonBone, SkeletonShimmer } from '../../components/skeleton';

export interface ContributedProductCardProps {
  item: CommunityContributionRow;
  onPress?: () => void;
  isLoading?: boolean;
}

const STATUS_CONFIG: Partial<
  Record<CommunityContributionRow['status'], { label: string; text: string; bg: string }>
> = {
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

export function ContributedProductCard({ item, onPress, isLoading = false }: ContributedProductCardProps) {
  const theme = useTheme();
  const statusConfig = STATUS_CONFIG[item.status];
  const formattedDate = formatDate(item.createdAt);
  return (
    <Pressable
      testID={`contributed-card-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={statusConfig ? `${item.name}, ${statusConfig.label}` : item.name}
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
      {isLoading ? (
        <View
          testID="contributed-card-thumbnail-skeleton"
          style={{
            width: 48,
            height: 48,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.neutralLight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: theme.colors.bgGlass,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        </View>
      ) : item.coverPhotoId ? (
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
        {isLoading ? (
          <SkeletonShimmer style={{ gap: 4 }}>
            <SkeletonBone
              testID="contributed-card-title-skeleton"
              width="65%"
              height={15}
              borderRadius={4}
            />
            <SkeletonBone
              testID="contributed-card-subtitle-skeleton"
              width="45%"
              height={12}
              borderRadius={3}
            />
            <SkeletonBone
              testID="contributed-card-barcode-skeleton"
              width="30%"
              height={10}
              borderRadius={3}
            />
          </SkeletonShimmer>
        ) : (
          <>
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
          </>
        )}
      </View>
      {/* Right side: status pill + photo & edit badges */}
      <View style={{ alignItems: 'flex-end', gap: 6 }}>
        {isLoading ? (
          <SkeletonShimmer>
            <SkeletonBone
              testID="contributed-card-status-skeleton"
              width={75}
              height={20}
              borderRadius={theme.radii.sm}
            />
          </SkeletonShimmer>
        ) : statusConfig ? (
          <View
            style={{
              backgroundColor: statusConfig.bg,
              paddingHorizontal: 8,
              paddingVertical: 3,
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
