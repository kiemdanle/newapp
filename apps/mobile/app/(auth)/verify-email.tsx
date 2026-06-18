import React, { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function VerifyEmail() {
  const router = useRouter();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const params = useLocalSearchParams<{ token?: string }>();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onResend() {
    setMessage(null);
    setError(null);
    if (!user?.email) {
      setError('No email on file');
      return;
    }
    setLoading(true);
    try {
      await authEndpoints.resendVerification(user.email);
      setMessage('Verification email sent. Check your inbox.');
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: theme.typeRamp.headlineMedium.fontSize, fontWeight: theme.typeRamp.headlineMedium.fontWeight as any, color: theme.colors.text }}>
        Verify your email
      </Text>
      <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>
        {params.token
          ? `We received a verification link. Open it on this device to finish signing up.`
          : `We sent a verification link to ${user?.email ?? 'your inbox'}. Tap it on this device to continue.`}
      </Text>
      {message ? <Text style={{ color: theme.colors.success }}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button testID="verify-resend" label="Resend email" onPress={onResend} loading={loading} />
      <Button
        label="Back to sign in"
        variant="ghost"
        onPress={() => router.replace('/(auth)/sign-in')}
      />
    </Screen>
  );
}
