import React, { useState } from 'react';
import { Platform, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { TextField } from '../../src/components/TextField';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function VerifyEmail() {
  const router = useRouter();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const signIn = useSessionStore((s) => s.signIn);
  const accessToken = useSessionStore((s) => s.accessToken);
  const pendingAuth = useSessionStore((s) => s.pendingAuth);
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? pendingAuth?.user.email ?? user?.email ?? '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function onResend() {
    setMessage(null);
    setError(null);
    if (!email) {
      setError('No email on file');
      return;
    }
    setResending(true);
    try {
      await authEndpoints.resendVerification(email);
      setMessage('Verification code sent. Check your inbox.');
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(value = code) {
    const verificationCode = value.replace(/\D/g, '');
    setMessage(null);
    setError(null);
    if (!email) {
      setError('No email on file');
      return;
    }
    if (verificationCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      await authEndpoints.verifyEmail({ email, code: verificationCode });
      if (pendingAuth) {
        // Registration flow: the session was held until now. Commit it (with the
        // now-verified flag) so the user lands authenticated on home.
        await signIn({ ...pendingAuth, user: { ...pendingAuth.user, emailVerified: true } });
        router.replace('/(app)/(tabs)/home');
      } else if (accessToken) {
        // Already authenticated and just needed to verify — mark verified.
        if (user) setUser({ ...user, emailVerified: true });
        router.replace('/(app)/(tabs)/home');
      } else {
        // Reached here from the sign-in "email not verified" path with no session
        // — send the user back to sign in now that the email is confirmed.
        router.replace('/(auth)/sign-in');
      }
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function onCodeChange(value: string) {
    const next = value.replace(/\D/g, '').slice(0, 6);
    setCode(next);
    if (next.length === 6 && !loading) void onSubmit(next);
  }

  return (
    <Screen backFallback="/(auth)/sign-in">
      <Text
        style={{
          fontSize: theme.typeRamp.headlineMedium.fontSize,
          fontWeight: theme.typeRamp.headlineMedium.fontWeight as any,
          color: theme.colors.text,
        }}
      >
        Verify your email
      </Text>
      <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>
        {`Enter the 6-digit code sent to ${email || 'your inbox'}. Your keyboard may offer it as a quick-fill suggestion.`}
      </Text>
      <TextField
        label="Verification code"
        value={code}
        onChangeText={onCodeChange}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete={Platform.select({
          ios: 'one-time-code',
          android: 'sms-otp',
          default: 'one-time-code',
        })}
        maxLength={6}
        autoFocus
        placeholder="123456"
      />
      {message ? <Text style={{ color: theme.colors.success }}>{message}</Text> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        testID="verify-submit"
        label="Verify email"
        onPress={() => void onSubmit()}
        loading={loading}
        disabled={code.length !== 6}
      />
      <Button
        testID="verify-resend"
        label="Resend code"
        variant="outline"
        onPress={onResend}
        loading={resending}
      />
      <Button
        label="Back to sign in"
        variant="ghost"
        onPress={() => router.replace('/(auth)/sign-in')}
      />
    </Screen>
  );
}
