import { Pressable, Text, Platform } from 'react-native';
import { useTheme } from '../theme/useTheme';

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
      style={({ pressed }) => ({
        backgroundColor: disabled ? t.colors.bgGlass : t.colors.accent,
        borderRadius: t.radii.lg,
        paddingVertical: t.spacing.md,
        paddingHorizontal: t.spacing.xl,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        transform: [{ translateY: pressed ? 2 : 0 }],
        ...(ios ? {
          shadowColor: '#3A2A20',
          shadowOffset: { width: 0, height: pressed ? 2 : 6 },
          shadowOpacity: pressed ? 0.08 : 0.14,
          shadowRadius: pressed ? 6 : 12,
        } : {
          elevation: pressed ? 2 : 6,
        }),
      })}
    >
      <Text style={{
        color: t.colors.textInverse,
        fontSize: t.typeRamp.labelLarge.fontSize,
        fontWeight: t.typeRamp.labelLarge.fontWeight as any,
      }}>{title}</Text>
    </Pressable>
  );
}
