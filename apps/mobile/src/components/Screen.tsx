import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { AuthBackButton } from './AuthBackButton';

export function Screen({
  children,
  scroll = true,
  padded = true,
  backFallback,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  backFallback?: string;
}) {
  const theme = useTheme();
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.bg }]}>
      <Body
        contentContainerStyle={[styles.body, padded && styles.padded]}
        style={styles.flex}
        showsVerticalScrollIndicator={false}
      >
        {backFallback ? <AuthBackButton fallback={backFallback} /> : null}
        {children}
      </Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: { flexGrow: 1 },
  padded: { padding: 24, gap: 16, paddingBottom: 110 },
});
