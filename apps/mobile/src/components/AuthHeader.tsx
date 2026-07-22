import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Logo, LogoLockup } from './Logo';
import { useTheme } from '../theme/useTheme';

type AuthHeaderProps = {
  title: string;
  description: string;
  email?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  compact?: boolean;
};

/** Shared, deliberately compact identity block for every authentication route. */
export function AuthHeader({ title, description, email, icon, compact = false }: AuthHeaderProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const lockupWidth = Math.min(compact ? 132 : 150, Math.max(120, width - 48));

  return (
    <View style={styles.wrap}>
      {icon ? (
        <View style={[styles.iconBadge, { backgroundColor: theme.colors.primaryLight }]}>
          <Ionicons name={icon} size={24} color={theme.colors.primaryDark} />
        </View>
      ) : (
        <View testID="auth-brand-lockup" style={{ maxWidth: 272 }}>
          <LogoLockup width={lockupWidth} />
        </View>
      )}
      <Text
        style={[
          styles.title,
          {
            color: theme.colors.text,
            fontSize: compact ? theme.typeRamp.titleLarge.fontSize : theme.typeRamp.headlineMedium.fontSize,
            lineHeight: compact ? theme.typeRamp.titleLarge.lineHeight : theme.typeRamp.headlineMedium.lineHeight,
            fontWeight: theme.typeRamp.headlineMedium.fontWeight as any,
          },
        ]}
      >
        {title}
      </Text>
      <Text style={[styles.description, { color: theme.colors.textMuted }]}>{description}</Text>
      {email ? <Text style={[styles.email, { color: theme.colors.primaryDark }]}>{email}</Text> : null}
    </View>
  );
}

export function AuthBrandBar() {
  const theme = useTheme();
  return (
    <View style={styles.brandBar}>
      <Logo size={30} withWordmark />
      <View style={[styles.freshBadge, { backgroundColor: theme.colors.primaryLight }]}>
        <Text style={[styles.freshText, { color: theme.colors.primaryDark }]}>Fresh</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 8, marginBottom: 8 },
  iconBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  title: { textAlign: 'center' },
  description: { maxWidth: 336, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  email: { maxWidth: 300, fontSize: 15, lineHeight: 21, fontWeight: '700', textAlign: 'center' },
  brandBar: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  freshBadge: { minHeight: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: 'center' },
  freshText: { fontSize: 13, fontWeight: '700' },
});
