import { View, TextInput, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';

type Props = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
};

export function MD3TextField({ label, value, onChangeText, error, secureTextEntry, keyboardType }: Props) {
  const t = useTheme();
  return (
    <View style={{ marginVertical: t.spacing.sm }}>
      <Text style={{
        color: error ? t.colors.danger : t.colors.textMuted,
        fontSize: t.typeRamp.labelMedium.fontSize,
        marginBottom: t.spacing.xs,
      }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        style={{
          minHeight: 48,
          borderWidth: 1,
          borderColor: error ? t.colors.danger : t.colors.border,
          borderRadius: t.radii.sm,
          paddingHorizontal: t.spacing.md,
          color: t.colors.text,
          fontSize: t.typeRamp.bodyLarge.fontSize,
          backgroundColor: t.colors.bgElevated,
        }}
      />
      {error ? (
        <Text style={{ color: t.colors.danger, fontSize: t.typeRamp.bodySmall.fontSize, marginTop: t.spacing.xs }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
