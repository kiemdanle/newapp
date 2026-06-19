import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export function ReferralCodeCard({
  code,
  shareUrl: _shareUrl,
}: {
  code: string;
  shareUrl: string;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityLabel={`Your invite code: ${code}`}
      style={{
        padding: t.spacing.lg,
        borderRadius: t.radii.lg,
        backgroundColor: t.colors.bgElevated,
        borderWidth: 1,
        borderColor: t.colors.border,
        alignItems: 'center',
        gap: t.spacing.sm,
      }}
    >
      <Text
        style={{
          color: t.colors.textMuted,
          fontSize: t.typeRamp.labelMedium.fontSize,
          fontWeight: t.typeRamp.labelMedium.fontWeight as any,
        }}
      >
        Your invite code
      </Text>
      <Text
        style={{
          color: t.colors.text,
          fontSize: 28,
          fontWeight: t.typography.weightBold as any,
          fontFamily: t.typography.fontFamilyDisplay,
          letterSpacing: 4,
        }}
      >
        {code}
      </Text>
    </View>
  );
}
