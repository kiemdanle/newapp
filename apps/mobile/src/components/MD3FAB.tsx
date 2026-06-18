import { Pressable, Text, Platform } from 'react-native';
import { useTheme } from '../theme/useTheme';

type Props = { icon: string; onPress: () => void; accessibilityLabel: string };

export function MD3FAB({ icon, onPress, accessibilityLabel }: Props) {
  const t = useTheme();
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
          ? { shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.30, shadowRadius: 5 }
          : { elevation: 6 }),
      }}
    >
      <Text style={{ color: t.colors.textInverse, fontSize: 24 }}>{icon === 'qrcode-scan' ? '⊟' : '+'}</Text>
    </Pressable>
  );
}
