import React from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/useTheme';
import { AuthBackButton } from './AuthBackButton';
import { KeyboardAwareScrollView } from './KeyboardAwareScrollView';

export function Screen({
  children,
  scroll = true,
  padded = true,
  backFallback,
  style,
  contentContainerStyle,
  keyboardAvoiding = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
  backFallback?: string;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
}) {
  const theme = useTheme();

  if (scroll) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.bg }]}>
        <KeyboardAwareScrollView
          contentContainerStyle={[styles.body, padded && styles.padded, contentContainerStyle]}
          style={[styles.flex, style]}
          keyboardAvoiding={keyboardAvoiding}
        >
          {backFallback ? <AuthBackButton fallback={backFallback} /> : null}
          {children}
        </KeyboardAwareScrollView>
      </SafeAreaView>
    );
  }

  const content = (
    <View
      style={[styles.flex, style, padded && styles.padded, contentContainerStyle]}
    >
      {backFallback ? <AuthBackButton fallback={backFallback} /> : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.colors.bg }]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {content}
        </KeyboardAvoidingView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  body: { flexGrow: 1 },
  padded: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 84, gap: 16 },
});
