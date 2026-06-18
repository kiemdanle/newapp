import React from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/useTheme';

export function GlassCard({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { borderRadius: theme.radii.lg, borderColor: theme.colors.border }]}>
      <BlurView
        intensity={40}
        tint={theme.scheme === 'dark' ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.inner, { backgroundColor: theme.colors.bgGlass }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', borderWidth: 1 },
  inner: { padding: 18, gap: 12 },
});
