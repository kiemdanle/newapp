import { Pressable, Text, Platform } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { parseShadow } from '../theme/shadow';

type Props = { title: string; onPress: () => void; disabled?: boolean };

export function ClayButton({ title, onPress, disabled }: Props) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => {
        const shadow = parseShadow(pressed ? t.elevation.clay.ambient : t.elevation.clay.base);
        return {
          backgroundColor: disabled ? t.colors.bgGlass : t.colors.accent,
          borderRadius: t.radii.lg,
          paddingVertical: t.spacing.md,
          paddingHorizontal: t.spacing.xl,
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ translateY: pressed ? 2 : 0 }],
          ...(ios ? {
            shadowColor: shadow.shadowColor,
            shadowOffset: shadow.shadowOffset,
            shadowOpacity: shadow.shadowOpacity,
            shadowRadius: shadow.shadowRadius,
          } : {
            elevation: shadow.elevation,
          }),
        };
      }}
    >
      <Text style={{
        color: t.colors.textInverse,
        fontSize: t.typeRamp.labelLarge.fontSize,
        fontWeight: t.typeRamp.labelLarge.fontWeight as any,
      }}>{title}</Text>
    </Pressable>
  );
}
