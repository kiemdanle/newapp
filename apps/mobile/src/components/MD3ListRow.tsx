import { Pressable, View, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';

type Props = {
  leadingIcon?: string;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
};

export function MD3ListRow({ title, subtitle, trailing, onPress }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={{
        minHeight: 56,
        paddingHorizontal: t.spacing.lg,
        paddingVertical: t.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: t.colors.bgElevated,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{
          color: t.colors.text,
          fontSize: t.typeRamp.bodyLarge.fontSize,
          lineHeight: t.typeRamp.bodyLarge.lineHeight,
        }}>{title}</Text>
        {subtitle ? (
          <Text style={{
            color: t.colors.textMuted,
            fontSize: t.typeRamp.bodySmall.fontSize,
          }}>{subtitle}</Text>
        ) : null}
      </View>
      {trailing}
    </Pressable>
  );
}
