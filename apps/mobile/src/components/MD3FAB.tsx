import { Pressable, Text, Platform } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { parseShadow } from '../theme/shadow';

type Props = { icon: string; onPress: () => void; accessibilityLabel: string };

export function MD3FAB({ icon, onPress, accessibilityLabel }: Props) {
  const t = useTheme();
  const shadow = parseShadow(t.elevation.md3.level3);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={{
        width: 56, height: 56,
        borderRadius: t.radii.lg,
        backgroundColor: t.colors.accent,
        alignItems: 'center', justifyContent: 'center',
        ...(Platform.OS === 'ios'
          ? { shadowColor: shadow.shadowColor, shadowOffset: shadow.shadowOffset, shadowOpacity: shadow.shadowOpacity, shadowRadius: shadow.shadowRadius }
          : { elevation: shadow.elevation }),
      }}
    >
      <Text style={{ color: t.colors.textInverse, fontSize: t.typeRamp.titleLarge.fontSize }}>{icon === 'qrcode-scan' ? '⊟' : '+'}</Text>
    </Pressable>
  );
}
