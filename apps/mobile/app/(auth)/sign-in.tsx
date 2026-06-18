import React, { useEffect, useState } from 'react';
import { Platform, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { loginSchema } from '@expyrico/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
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
        router.push('/(auth)/verify-email');
        return;
      }
      setFormError(e.title);
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
        // Mobile users hitting this means they have an admin account —
        // route them to the admin web app for the TOTP step.
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
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>
        Welcome back
      </Text>
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
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button testID="sign-in-submit" label="Sign in" onPress={onSubmit} loading={loading} />
      <Button
        label="Forgot password?"
        variant="ghost"
        onPress={() => router.push('/(auth)/forgot-password')}
      />
      <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 8 }}>
        or continue with
      </Text>
      <Button
        testID="sign-in-google"
        label="Continue with Google"
        variant="secondary"
        onPress={onGoogle}
      />
      {appleAvailable && Platform.OS === 'ios' ? (
        <Button
          testID="sign-in-apple"
          label="Continue with Apple"
          variant="secondary"
          onPress={onApple}
        />
      ) : null}
      <Button testID="sign-in-passkey" label="Use a passkey" variant="ghost" onPress={onPasskey} />
    </Screen>
  );
}
