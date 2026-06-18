import { View, Platform } from 'react-native';
import { useTheme } from '../theme/useTheme';
import { parseShadow } from '../theme/shadow';

type Props = { children: React.ReactNode; padded?: boolean };

export function ClayCard({ children, padded = true }: Props) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  const shadow = parseShadow(t.elevation.clay.base);
  return (
    <View
      style={{
        backgroundColor: t.colors.bgElevated,
        borderRadius: t.radii.md,
        padding: padded ? t.spacing.lg : 0,
        ...(ios ? {
          shadowColor: shadow.shadowColor,
          shadowOffset: shadow.shadowOffset,
          shadowOpacity: shadow.shadowOpacity,
          shadowRadius: shadow.shadowRadius,
        } : {
          elevation: shadow.elevation,
        }),
      }}
    >
      {children}
    </View>
  );
}
