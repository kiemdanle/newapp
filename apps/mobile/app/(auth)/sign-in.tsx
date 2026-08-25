import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
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
import { signInWithPasskey, isPasskeyCancellation } from '../../src/auth/passkey';

export default function SignIn() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const theme = useTheme();
  const signIn = useSessionStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inFlightRef = useRef(false);
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
    if (loading) return;
    setFormError(null);
    setFormNotice(null);
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
    if (loading) return;
    setFormError(null);
    setFormNotice(null);
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
    if (loading) return;
    setFormError(null);
    setFormNotice(null);
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
    if (loading || inFlightRef.current) return;
    inFlightRef.current = true;
    setFormError(null);
    setFormNotice(null);
    const trimmed = email.trim().toLowerCase();
    setLoading(true);
    try {
      const result = await signInWithPasskey(trimmed && trimmed.includes('@') ? trimmed : undefined);
      if (result) {
        await signIn(result);
      }
      // AuthGate will flip to App stack once accessToken is set.
    } catch (e) {
      if (isPasskeyCancellation(e)) {
        setFormNotice('Passkey sign-in was cancelled.');
        return;
      }
      handleApiError(e);
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }

  return (
    <Screen backFallback="/(auth)/welcome" contentContainerStyle={styles.container}>
      <AuthHeader
        compact
        title="Welcome back"
        description="Sign in to your Expyrico pantry"
      />

      <View style={styles.form}>
        <TextField
          label="Email"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
        />
        <View style={styles.passwordWrap}>
          <TextField
            label="Password"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            showPasswordToggle
            value={password}
            onChangeText={setPassword}
            error={errors.password}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Forgot password?"
            hitSlop={8}
            style={styles.forgotLink}
            onPress={() => navigation.navigate('ForgotPassword')}
          >
            <Text style={[styles.forgotText, { color: theme.colors.primaryDark }]}>
              Forgot?
            </Text>
          </Pressable>
        </View>
      </View>

      <Button
        testID="sign-in-submit"
        label="Sign in"
        onPress={onSubmit}
        loading={loading}
      />

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      {formNotice ? (
        <Text style={[styles.noticeText, { color: theme.colors.textMuted }]}>
          {formNotice}
        </Text>
      ) : null}

      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
        <Text style={[styles.dividerText, { color: theme.colors.textMuted }]}>
          or continue with
        </Text>
        <View style={[styles.dividerLine, { backgroundColor: theme.colors.border }]} />
      </View>

      <View style={styles.socialRow}>
        <Pressable
          testID="sign-in-google"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.socialBtn,
            {
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.primaryLight : theme.colors.card,
            },
          ]}
          onPress={onGoogle}
          disabled={loading}
        >
          <GoogleLogo size={18} />
          <Text style={[styles.socialBtnText, { color: theme.colors.text }]}>Google</Text>
        </Pressable>

        <Pressable
          testID="sign-in-passkey"
          accessibilityLabel="Use a passkey"
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.socialBtn,
            {
              borderColor: theme.colors.border,
              backgroundColor: pressed ? theme.colors.primaryLight : theme.colors.card,
            },
          ]}
          onPress={onPasskey}
          disabled={loading}
        >
          <Ionicons name="key" size={17} color={theme.colors.primary} />
          <Text style={[styles.socialBtnText, { color: theme.colors.text }]}>Passkey</Text>
        </Pressable>

        {appleAvailable && Platform.OS === 'ios' ? (
          <Pressable
            testID="sign-in-apple"
            accessibilityLabel="Continue with Apple"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.socialBtn,
              {
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.primaryLight : theme.colors.card,
              },
            ]}
            onPress={onApple}
            disabled={loading}
          >
            <Ionicons name="logo-apple" size={18} color={theme.colors.text} />
            <Text style={[styles.socialBtnText, { color: theme.colors.text }]}>Apple</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.footerRow}>
        <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
          Don't have an account?
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sign up"
          hitSlop={8}
          onPress={() => navigation.navigate('SignUp')}
        >
          <Text style={[styles.signUpText, { color: theme.colors.primaryDark }]}>
            Sign up
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 12,
  },
  form: {
    gap: 10,
  },
  passwordWrap: {
    position: 'relative',
  },
  forgotLink: {
    position: 'absolute',
    top: 0,
    right: 0,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noticeText: {
    textAlign: 'center',
    fontSize: 13,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '500',
  },
  socialRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  socialBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  footerText: {
    fontSize: 14,
  },
  signUpText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
