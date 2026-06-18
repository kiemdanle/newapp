import React from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../../src/components/Screen';
import { Button } from '../../../src/components/Button';
import { Card } from '../../../src/components/Card';
import { useTheme } from '../../../src/theme/useTheme';
import { useSessionStore } from '../../../src/auth/session-store';
import { authEndpoints } from '../../../src/api/endpoints';

export default function Profile() {
  const router = useRouter();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const signOut = useSessionStore((s) => s.signOut);

  async function onSignOut() {
    try {
      await authEndpoints.logout();
    } catch {
      /* best-effort */
    }
    await signOut();
  }

  return (
    <Screen>
      <Text style={{ fontSize: theme.typeRamp.headlineMedium.fontSize, fontWeight: theme.typeRamp.headlineMedium.fontWeight as any, color: theme.colors.text }}>Profile</Text>
      <Card>
        <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.titleMedium.fontSize, fontWeight: theme.typeRamp.titleMedium.fontWeight as any }}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>{user?.email}</Text>
      </Card>
      <View style={{ gap: 8 }}>
        <Button
          testID="profile-settings"
          label="Settings"
          variant="secondary"
          onPress={() => router.push('/(app)/settings/index')}
        />
        <Button testID="profile-sign-out" label="Sign out" variant="danger" onPress={onSignOut} />
      </View>
    </Screen>
  );
}
