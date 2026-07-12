import React, { useState } from 'react';
import { Platform, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { TextField } from '../../src/components/TextField';
import { authEndpoints } from '../../src/api/endpoints';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function VerifyResetCode() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email ?? '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  // After a failed verify the code is likely dead (single active code per account,
  // capped attempts). Surface a prominent resend affordance rather than let the
  // user re-submit the same doomed code (RT-12 terminal state).
  const [failed, setFailed] = useState(false);

  async function onResend() {
    setMessage(null);
    setError(null);
    if (!email) {
      setError('No email on file. Start over from forgot password.');
      return;
    }
    setResending(true);
    try {
      await authEndpoints.forgotPassword(email);
      // Resending replaces the previous code — be explicit so a user who typed
      // the old code understands why it stops working (RT-12 resend race).
      setMessage('New code sent. It replaces any earlier code.');
      setFailed(false);
      setCode('');
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(value = code) {
    const resetCode = value.replace(/\D/g, '');
    setMessage(null);
    setError(null);
    if (!email) {
      setError('No email on file. Start over from forgot password.');
      return;
    }
    if (resetCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      const { resetTicket } = await authEndpoints.verifyResetCode(email, resetCode);
      router.push({ pathname: '/(auth)/reset-password', params: { ticket: resetTicket } });
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
      setFailed(true);
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
    <Screen backFallback="/(auth)/forgot-password">
      <Text
        style={{
          fontSize: theme.typeRamp.headlineMedium.fontSize,
          fontWeight: theme.typeRamp.headlineMedium.fontWeight as any,
          color: theme.colors.text,
        }}
      >
        Enter your reset code
      </Text>
      <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>
        {`Enter the 6-digit code sent to ${email || 'your inbox'}. Your keyboard may offer it as a quick-fill suggestion.`}
      </Text>
      <TextField
        label="Reset code"
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
      {failed ? (
        <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>
          That code didn't work. Request a new one below.
        </Text>
      ) : null}
      <Button
        testID="verify-reset-submit"
        label="Verify code"
        onPress={() => void onSubmit()}
        loading={loading}
        disabled={code.length !== 6}
      />
      <Button
        testID="verify-reset-resend"
        label="Request a new code"
        variant={failed ? 'primary' : 'outline'}
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
