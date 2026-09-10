import React from 'react';
import { StyleSheet, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  EXPYRICO_BADGE_COLORS,
  type ContributorBadgeKey,
  type ExpyricoBadgeColorToken,
} from '@expyrico/shared';

export interface ContributorBadgeIconProps {
  badgeKey: ContributorBadgeKey;
  colorToken: ExpyricoBadgeColorToken;
  size?: number;
}

const BADGE_IONICONS: Record<ContributorBadgeKey, string> = {
  seedling: 'leaf',
  bronze_star: 'star-outline',
  silver_star: 'star-half',
  gold_star: 'star',
  emerald_gem: 'shield-checkmark',
  sapphire_crown: 'trophy',
  diamond_starburst: 'sparkles',
};

export function ContributorBadgeIcon({
  badgeKey,
  colorToken,
  size = 48,
}: ContributorBadgeIconProps) {
  const colorHex = EXPYRICO_BADGE_COLORS[colorToken] ?? '#4BAE8A';
  const iconName = BADGE_IONICONS[badgeKey] ?? 'star';
  const iconSize = Math.round(size * 0.52);

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: colorHex,
          backgroundColor: `${colorHex}18`, // 10% opacity soft background
        },
      ]}
      testID="contributor-badge-icon"
    >
      <Ionicons name={iconName} size={iconSize} color={colorHex} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
