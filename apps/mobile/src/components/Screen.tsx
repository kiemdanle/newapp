import React from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { AuthBackButton } from './AuthBackButton';

export function Screen({
  children,
  scroll = true,
  padded = true,
  backFallback,
  style,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  backFallback?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.bg }]}>
      <Body
        contentContainerStyle={[styles.body, padded && styles.padded, contentContainerStyle]}
        style={[styles.flex, style]}
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
