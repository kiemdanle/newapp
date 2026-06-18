import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme/useTheme';

export function ErrorText({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <Text testID={testID} style={[styles.t, { color: theme.colors.danger }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  t: { fontSize: 14, fontWeight: '500' },
});
