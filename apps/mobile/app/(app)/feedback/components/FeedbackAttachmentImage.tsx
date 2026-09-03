import React from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  type StyleProp,
  type ImageStyle,
} from 'react-native';
import { useCachedImage } from '@/cache/useCachedImage';
import { apiUrl } from '@/api/client';
import { useTheme } from '@/theme/useTheme';

export function FeedbackAttachmentImage({
  attachmentId,
  style,
}: {
  attachmentId: string;
  style?: StyleProp<ImageStyle>;
}) {
  const theme = useTheme();
  const { uri, isLoading } = useCachedImage({
    uri: apiUrl(`/feedback/attachments/${attachmentId}`),
    isPrivate: true,
  });

  if (isLoading || !uri) {
    return (
      <View style={[styles.placeholder, { backgroundColor: theme.colors.bgElevated }, style]}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri, cache: 'force-cache' }}
      style={style}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
