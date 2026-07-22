import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../src/navigation/AuthNavigator';
import { Screen } from '../../src/components/Screen';
import { ErrorText } from '../../src/components/ErrorText';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { AuthHeader } from '../../src/components/AuthHeader';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyEmail() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const setUser = useSessionStore((s) => s.setUser);
  const signIn = useSessionStore((s) => s.signIn);
  const accessToken = useSessionStore((s) => s.accessToken);
  const pendingAuth = useSessionStore((s) => s.pendingAuth);
  const route = useRoute();
  const { email } = route.params as { email?: string };
  const emailAddress = email ?? pendingAuth?.user.email ?? user?.email ?? '';
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Tick the resend cooldown down once a second while it's active.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  async function onResend() {
    setMessage(null);
    setError(null);
    if (!emailAddress) {
      setError('No email on file');
      return;
    }
    setResending(true);
    try {
      await authEndpoints.resendVerification(emailAddress);
      setMessage('Verification code sent. Check your inbox.');
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setResending(false);
    }
  }

  // Wrong address? Go back to where the flow started so the user can re-enter it.
  function onChangeEmail() {
    navigation.replace(pendingAuth ? 'SignUp' : 'SignIn');
  }

  async function onSubmit(value = code) {
    const verificationCode = value.replace(/\D/g, '');
    setMessage(null);
    setError(null);
    if (!emailAddress) {
      setError('No email on file');
      return;
    }
    if (verificationCode.length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setLoading(true);
    try {
      await authEndpoints.verifyEmail({ email: emailAddress, code: verificationCode });
      if (pendingAuth) {
        // Registration flow: the session was held until now. Commit it (with the
        // now-verified flag) so the user lands authenticated on home.
        await signIn({ ...pendingAuth, user: { ...pendingAuth.user, emailVerified: true } });
        // AuthGate will flip to App stack once accessToken is set.
      } else if (accessToken) {
        // Already authenticated and just needed to verify — mark verified.
        if (user) setUser({ ...user, emailVerified: true });
        // AuthGate will keep the user in the App stack.
      } else {
        // Reached here from the sign-in "email not verified" path with no session
        // — send the user back to sign in now that the email is confirmed.
        navigation.replace('SignIn');
      }
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function onCodeChange(next: string) {
    setCode(next);
    if (error) setError(null);
    if (next.length === 6 && !loading) void onSubmit(next);
  }

  const resendDisabled = resending || cooldown > 0;

  return (
    <Screen backFallback="/(auth)/sign-in">
      <AuthHeader icon="mail-outline" title="Check your inbox" description="Enter the 6-digit code we sent to" email={emailAddress || undefined} />

      <OtpInput
        label="Verification code"
        value={code}
        onChangeText={onCodeChange}
        autoFocus
        editable={!loading}
        error={!!error}
      />

      <View style={styles.pillRow}>
        <View style={[styles.pill, { backgroundColor: theme.colors.accentLight }]}>
          <Ionicons name="time-outline" size={15} color={theme.colors.accent} />
          <Text style={[styles.pillText, { color: theme.colors.text }]}>
            Code expires in 10 minutes
          </Text>
        </View>
      </View>

      {message ? (
        <Text style={[styles.status, { color: theme.colors.success }]}>{message}</Text>
      ) : null}
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
        onPress={onResend}
        disabled={resendDisabled}
        loading={resending}
        variant="outline"
        icon="refresh-outline"
        label={cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
      />

      <Button
        testID="verify-change-email"
        onPress={onChangeEmail}
        variant="ghost"
        label="Change email"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pillRow: { alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  pillText: { fontSize: 13, fontWeight: '600', includeFontPadding: false },
  status: { textAlign: 'center', fontSize: 14, fontWeight: '500' },
});
