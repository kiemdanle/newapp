import { Pressable, View, Text, StyleSheet } from 'react-native';
import { themeList, type Theme } from '@expyrico/theme';
import { useTheme } from '../../../src/theme/useTheme';
import { useThemeStore } from '../../../src/theme/store';

export default function ThemeSettings() {
  const active = useTheme();
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <View style={styles.root}>
      <Text style={{ fontSize: active.typeRamp.headlineMedium.fontSize, fontWeight: active.typeRamp.headlineMedium.fontWeight as any, color: active.colors.text }}>
        Theme
      </Text>
      <Text style={{ color: active.colors.textMuted, marginBottom: active.spacing.md, fontSize: active.typeRamp.bodyMedium.fontSize }}>
        Tap a card to switch instantly.
      </Text>
      <View style={styles.grid}>
        {themeList.map((t) => (
          <ThemePreviewCard
            key={t.id}
            theme={t}
            selected={t.id === active.id}
            onPress={() => setTheme(t.id)}
          />
        ))}
      </View>
    </View>
  );
}

function ThemePreviewCard({
  theme,
  selected,
  onPress,
}: {
  theme: Theme;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`theme-card-${theme.id}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`Use ${theme.name} theme`}
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
        {theme.name}
      </Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.typeRamp.bodySmall.fontSize }}>
        {theme.scheme === 'dark' ? 'Dark' : 'Light'}
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
