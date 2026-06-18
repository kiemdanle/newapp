import { View, Platform } from 'react-native';
import { useTheme } from '../theme/useTheme';

type Props = { children: React.ReactNode; padded?: boolean };

export function ClayCard({ children, padded = true }: Props) {
  const t = useTheme();
  const ios = Platform.OS === 'ios';
  return (
    <View
      style={{
        backgroundColor: t.colors.bgElevated,
        borderRadius: t.radii.md,
        padding: padded ? t.spacing.lg : 0,
        ...(ios ? {
          shadowColor: '#3A2A20',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
        } : {
          elevation: 6,
        }),
      }}
    >
      {children}
    </View>
  );
}
