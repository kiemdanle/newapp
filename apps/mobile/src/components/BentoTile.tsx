import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/useTheme';

type Size = 'sm' | 'md' | 'lg' | 'wide';
type Props = {
  size: Size;
  accent?: boolean;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  children?: React.ReactNode;
};

const sizeStyle = (size: Size) => {
  switch (size) {
    case 'sm':   return { aspectRatio: 1,    flex: 1 };
    case 'md':   return { aspectRatio: 1,    flex: 1 };
    case 'lg':   return { aspectRatio: 0.75, flex: 1 };
    case 'wide': return { aspectRatio: 2,    flex: 1 };
  }
};

export function BentoTile({ size, accent, title, subtitle, onPress, children }: Props) {
  const t = useTheme();
  return (
    <View
      accessible
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onTouchEnd={onPress}
      style={[
        sizeStyle(size),
        {
          backgroundColor: accent ? t.colors.accent : t.colors.bgElevated,
          borderColor: t.colors.border,
          borderWidth: 1,
          borderRadius: t.radii.md,
          padding: t.spacing.lg,
          minHeight: 88,
        },
      ]}
    >
      <Text style={{
        color: accent ? t.colors.textInverse : t.colors.text,
        fontSize: t.typeRamp.titleMedium.fontSize,
        lineHeight: t.typeRamp.titleMedium.lineHeight,
        fontWeight: t.typeRamp.titleMedium.fontWeight as any,
      }}>{title}</Text>
      {subtitle ? (
        <Text style={{
          color: accent ? t.colors.textInverse : t.colors.textMuted,
          fontSize: t.typeRamp.bodySmall.fontSize,
          lineHeight: t.typeRamp.bodySmall.lineHeight,
          marginTop: t.spacing.xs,
        }}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}
