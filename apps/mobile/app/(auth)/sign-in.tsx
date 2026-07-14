import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { loginSchema } from '@expyrico/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { ErrorText } from '../../src/components/ErrorText';
import { Button } from '../../src/components/Button';
import { AuthHeader } from '../../src/components/AuthHeader';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { isNetworkError, NETWORK_ERROR_MESSAGE } from '../../src/api/network-error';
import { useTheme } from '../../src/theme/useTheme';
import { signInWithGoogle, GoogleSignInCancelled } from '../../src/auth/google';
import { isAppleSignInAvailable, signInWithApple } from '../../src/auth/apple';
import { signInWithPasskey } from '../../src/auth/passkey';

export default function SignIn() {
  const router = useRouter();
  const theme = useTheme();
  const signIn = useSessionStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  function handleApiError(e: unknown) {
    if (isApiError(e)) {
      if (e.code === 'email_not_verified') {
        router.push({ pathname: '/(auth)/verify-email', params: { email } });
        return;
      }
      setFormError(e.title);
    } else if (isNetworkError(e)) {
      setFormError(NETWORK_ERROR_MESSAGE);
    } else {
      setFormError('Something went wrong');
    }
  }

  async function onSubmit() {
    setFormError(null);
    const input = { email, password };
    const errs = fieldErrors(loginSchema, input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const result = await authEndpoints.login(input);
      if ('requiresTotp' in result) {
        setFormError('This account requires admin TOTP; please sign in via the admin web.');
        return;
      }
      await signIn(result);
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function onGoogle() {
    setFormError(null);
    setLoading(true);
    try {
      const idToken = await signInWithGoogle();
      const result = await authEndpoints.oauthGoogle(idToken);
      await signIn(result);
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      if (e instanceof GoogleSignInCancelled) return;
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function onApple() {
    setFormError(null);
    setLoading(true);
    try {
      const cred = await signInWithApple();
      const result = await authEndpoints.oauthApple(
        cred.identityToken,
        cred.firstName,
        cred.lastName,
      );
      await signIn(result);
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function onPasskey() {
    setFormError(null);
    setLoading(true);
    try {
      const result = await signInWithPasskey(email || undefined);
      await signIn(result);
      router.replace('/(app)/(tabs)/home');
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen backFallback="/(auth)/welcome">
      <AuthHeader title="Welcome back" description="Sign in to scan items, track expiry dates, and keep your pantry current." />

      <View style={styles.form}>
        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
        />
        <TextField
          label="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          error={errors.password}
        />
      </View>

      <Button
        testID="sign-in-submit"
        label="Sign in"
        onPress={onSubmit}
        loading={loading}
      />

      <Button
        label="Forgot password?"
        variant="ghost"
        onPress={() => router.push('/(auth)/forgot-password')}
      />

      {formError ? <ErrorText>{formError}</ErrorText> : null}

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        <Text style={[styles.dividerText, { color: theme.colors.textMuted }]}>or continue with</Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
      </View>

      <Button
        testID="sign-in-google"
        label="Continue with Google"
        variant="outline"
        onPress={onGoogle}
      />
      {appleAvailable && Platform.OS === 'ios' ? (
        <Button
          testID="sign-in-apple"
          label="Continue with Apple"
          icon="logo-apple"
          variant="outline"
          onPress={onApple}
        />
      ) : null}
      <Button
        testID="sign-in-passkey"
        label="Use a passkey"
        icon="key"
        variant="ghost"
        onPress={onPasskey}
      />
    </Screen>
  );
}


const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    marginTop: 0,
  },
  logoAccent: {
    width: 58,
    height: 4,
    borderRadius: 999,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  logoAccentPrimary: {
    flex: 2,
  },
  logoAccentSecondary: {
    flex: 1,
  },
  title: { textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', paddingHorizontal: 12 },
  form: { gap: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '500' },
  actionFrame: {
    height: 52,
    width: '100%',
    borderWidth: 1.5,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
  actionPress: {
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  actionPressed: {
    opacity: 0.82,
  },
  actionRow: {
    height: '100%',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  actionLabel: {
    textAlign: 'center',
    includeFontPadding: false,
  },
});
