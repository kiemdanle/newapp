import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function GlassCard({ children, style }: { children: React.ReactNode; style?: any }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.inner,
        {
          backgroundColor: theme.colors.bgGlass,
          borderRadius: theme.radii.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  inner: { padding: 20, gap: 12 },
});
