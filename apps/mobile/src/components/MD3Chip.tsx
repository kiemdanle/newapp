import { Pressable, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';

type Props = { label: string; selected?: boolean; onPress?: () => void };

export function MD3Chip({ label, selected, onPress }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={{
        height: 32,
        minWidth: 48,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radii.sm,
        borderWidth: 1,
        borderColor: selected ? t.colors.accent : t.colors.border,
        backgroundColor: selected ? t.colors.bgGlass : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{
        color: selected ? t.colors.accent : t.colors.text,
        fontSize: t.typeRamp.labelLarge.fontSize,
        fontWeight: t.typeRamp.labelLarge.fontWeight as any,
      }}>{label}</Text>
    </Pressable>
  );
}
