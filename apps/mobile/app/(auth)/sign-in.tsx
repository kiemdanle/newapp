import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../src/navigation/AuthNavigator';
import { loginSchema } from '@expyrico/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { ErrorText } from '../../src/components/ErrorText';
import { Button } from '../../src/components/Button';
import { GoogleLogo } from '../../src/components/GoogleLogo';
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
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
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
        navigation.navigate('VerifyEmail', { email });
        return;
      }
      setFormError(e.title);
    } else if (isNetworkError(e)) {
      setFormError(NETWORK_ERROR_MESSAGE);
    } else if (e instanceof Error && e.message) {
      setFormError(e.message);
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
      // Handled by AuthGate / RootNavigator; no explicit navigation needed.
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
      // AuthGate will flip to App stack once accessToken is set.
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
      // AuthGate will flip to App stack once accessToken is set.
    } catch (e) {
      handleApiError(e);
    } finally {
      setLoading(false);
    }
  }

  async function onPasskey() {
    if (loading) return;
    setFormError(null);
    // Email is required so the server can return allowCredentials for this
    // account. Device-bound (non-discoverable) passkeys will otherwise make
    // Google Password Manager offer only "use a passkey from a different device".
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setFormError('Enter the email for this account, then tap Use a passkey.');
      return;
    }
    setLoading(true);
    try {
      const result = await signInWithPasskey(trimmed);
      await signIn(result);
      // AuthGate will flip to App stack once accessToken is set.
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
        onPress={() => navigation.navigate('ForgotPassword')}
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
        leading={<GoogleLogo />}
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
        loading={loading}
      />
    </Screen>
  );
}
const styles = StyleSheet.create({
  form: { gap: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '500' },
});
