import React from 'react';
import { Pressable, Share, Text } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export function InviteShareButton({
  shareUrl,
  code,
}: {
  shareUrl: string;
  code: string;
}) {
  const t = useTheme();

  async function onShare() {
    // The CODE is the attribution mechanism (entered at sign-up). The URL is
    // included as readable text only — v1.x provisions no universal/app links,
    // so it does NOT auto-open the app or auto-attribute installs.
    await Share.share({
      message: `Join me on Expyrico! Enter my invite code ${code} when you sign up. ${shareUrl}`,
      url: shareUrl,
    });
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Share invite"
      onPress={onShare}
      style={{
        padding: 14,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.primary,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: t.colors.primaryFg,
          fontSize: t.typeRamp.labelLarge.fontSize,
          fontWeight: t.typeRamp.labelLarge.fontWeight as any,
        }}
      >
        Share invite
      </Text>
    </Pressable>
  );
}
