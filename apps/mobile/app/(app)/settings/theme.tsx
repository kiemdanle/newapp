import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { themeList, type Theme } from '@expyrico/theme';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';
import { useThemeStore } from '../../../src/theme/store';

export default function ThemeSettings() {
  const active = useTheme();
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <Screen>
      <Text style={{ fontSize: 24, fontWeight: '700', color: active.colors.text }}>Theme</Text>
      <Text style={{ color: active.colors.textMuted, marginBottom: 8 }}>
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
    </Screen>
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
      accessibilityRole="button"
      accessibilityLabel={`Select ${theme.name} theme`}
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
      <View style={[styles.swatchRow]}>
        <View style={[styles.swatch, { backgroundColor: theme.colors.primary }]} />
        <View style={[styles.swatch, { backgroundColor: theme.colors.accent }]} />
        <View
          style={[
            styles.swatch,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
              borderWidth: 1,
            },
          ]}
        />
      </View>
      <Text style={{ color: theme.colors.text, fontWeight: '700' }}>{theme.name}</Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {theme.scheme === 'dark' ? 'Dark' : 'Light'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '47%', padding: 14, gap: 8 },
  swatchRow: { flexDirection: 'row', gap: 6 },
  swatch: { width: 22, height: 22, borderRadius: 6 },
});
