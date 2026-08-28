import React, { useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { useCachedImage } from '../cache/useCachedImage';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

const SIZE_MAP: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 44,
  lg: 56,
  xl: 80,
  xxl: 104,
};

const FONT_SIZE_MAP: Record<AvatarSize, number> = {
  xs: 10,
  sm: 13,
  md: 17,
  lg: 22,
  xl: 30,
  xxl: 38,
};

export interface AvatarProps {
  url?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
  size?: AvatarSize | number;
  editable?: boolean;
  onEditPress?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function Avatar({
  url,
  firstName,
  lastName,
  name,
  size = 'md',
  editable = false,
  onEditPress,
  style,
  testID = 'user-avatar',
}: AvatarProps) {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);
  const { uri: cachedUri } = useCachedImage(url);
  const activeUrl = cachedUri || url;
  const dimension = typeof size === 'number' ? size : SIZE_MAP[size] ?? 44;
  const fontSize =
    typeof size === 'number'
      ? Math.round(size * 0.4)
      : FONT_SIZE_MAP[size] ?? 17;

  let initials = '';
  if (firstName || lastName) {
    initials = `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
  } else if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      initials = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    } else {
      initials = (name[0] ?? '').toUpperCase();
    }
  }

  if (!initials) initials = '?';

  const badgeSize = Math.max(22, Math.round(dimension * 0.32));
  const badgeIconSize = Math.max(12, Math.round(badgeSize * 0.55));

  const showImage = Boolean(activeUrl) && !imageError;
  return (
    <View
      testID={testID}
      style={[
        styles.container,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor: theme.colors.primaryLight, // Mint Mist #D6F0E6
        },
        style,
      ]}
    >
      {showImage ? (
        <Image
          testID={`${testID}-image`}
          source={{ uri: activeUrl!, cache: 'force-cache' }}
          style={{
            width: dimension,
            height: dimension,
            borderRadius: dimension / 2,
          }}
          onError={() => setImageError(true)}
          resizeMode="cover"
        />
      ) : (
        <View
          testID={`${testID}-fallback`}
          style={[
            styles.fallbackContainer,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
            },
          ]}
        >
          <Ionicons
            name="person"
            size={Math.round(dimension * 0.5)}
            color={theme.colors.primary}
            style={styles.watermarkIcon}
          />
          <Text
            style={[
              styles.initialsText,
              {
                fontSize,
                color: theme.colors.primaryDark,
              },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}

      {editable && (
        <Pressable
          testID={`${testID}-edit-badge`}
          accessibilityRole="button"
          accessibilityLabel="Change avatar photo"
          onPress={onEditPress}
          style={({ pressed }) => [
            styles.editBadge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: pressed ? theme.colors.primaryDark : theme.colors.primary,
              borderColor: theme.colors.bg,
            },
          ]}
        >
          <Ionicons name="camera" size={badgeIconSize} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  fallbackContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkIcon: {
    position: 'absolute',
    opacity: 0.18,
  },
  initialsText: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
