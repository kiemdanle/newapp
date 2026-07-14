import { Pressable, View, Text, StyleSheet } from 'react-native';
import { themes, type Theme } from '@expyrico/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { useThemeStore } from '../../../src/theme/store';
import type { ThemePreference } from '../../../src/auth/secure-store';

const appearanceOptions = [
  { label: 'Light', theme: themes.expyrico, preference: 'expyrico' },
  { label: 'Dark', theme: themes.expyricoDark, preference: 'expyricoDark' },
] as const;

export default function ThemeSettings() {
  const active = useTheme();
  const themeId = useThemeStore((s) => s.themeId);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <View style={styles.root}>
      <Text style={{ fontSize: active.typeRamp.headlineMedium.fontSize, fontWeight: active.typeRamp.headlineMedium.fontWeight as any, color: active.colors.text }}>
        Theme
      </Text>
      <Text style={{ color: active.colors.textMuted, marginBottom: active.spacing.md, fontSize: active.typeRamp.bodyMedium.fontSize }}>
        Use system to follow your device dark or light setting.
      </Text>
      <View style={styles.grid}>
        <ThemePreviewCard
          label="System"
          description={`Device ${active.scheme === 'dark' ? 'dark' : 'light'}`}
          theme={active}
          selected={themeId === 'system'}
          preference="system"
          onPress={() => setTheme('system')}
        />
        {appearanceOptions.map(({ label, theme, preference }) => (
          <ThemePreviewCard
            key={preference}
            label={label}
            description={`${label} appearance`}
            theme={theme}
            selected={themeId === preference}
            preference={preference}
            onPress={() => setTheme(preference)}
          />
        ))}
      </View>
    </View>
  );
}

function ThemePreviewCard({
  label,
  description,
  theme,
  selected,
  preference,
  onPress,
}: {
  label: string;
  description: string;
  theme: Theme;
  selected: boolean;
  preference: ThemePreference;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`theme-card-${preference}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Use ${label} theme`}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bg,
          borderColor: selected ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.lg,
          borderWidth: selected ? 2 : 1,
        },
      ]}
    >
      <View style={styles.swatchRow}>
        <View style={[styles.swatch, { backgroundColor: theme.colors.primary, borderRadius: theme.radii.sm }]} />
        <View style={[styles.swatch, { backgroundColor: theme.colors.accent, borderRadius: theme.radii.sm }]} />
        <View
          style={[
            styles.swatch,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderWidth: 1,
              borderRadius: theme.radii.sm,
            },
          ]}
        />
      </View>
      <Text style={{ color: theme.colors.text, fontWeight: theme.typeRamp.titleMedium.fontWeight as any, fontSize: theme.typeRamp.titleMedium.fontSize }}>
        {label}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.typeRamp.bodySmall.fontSize }}>
        {description}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { padding: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', padding: 14, gap: 8 },
  swatchRow: { flexDirection: 'row', gap: 6 },
  swatch: { width: 22, height: 22 },
});
