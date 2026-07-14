import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { registerSchema } from '@expyrico/shared';
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
import {
  readPendingReferralCode,
  clearPendingReferralCode,
} from '../../src/referral/pendingReferralStore';

export default function SignUp() {
  const router = useRouter();
  const theme = useTheme();
  const setPendingAuth = useSessionStore((s) => s.setPendingAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [referralCode, setReferralCode] = useState<string | undefined>(undefined);
  const [codeManuallySet, setCodeManuallySet] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void readPendingReferralCode().then((c) => {
      if (c) setReferralCode(c);
    });
  }, []);

  async function onSubmit() {
    setFormError(null);
    const input = {
      email,
      password,
      firstName,
      lastName,
      ...(referralCode ? { referralCode } : {}),
    };
    const errs = fieldErrors(registerSchema, input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const result = await authEndpoints.register(input);
      await clearPendingReferralCode();
      // Hold the session as pending (do NOT sign in yet). Signing in would set
      // accessToken, and AuthGate bounces any token-holder in the (auth) group
      // straight to home — skipping the OTP step. verify-email commits the
      // session once the email is confirmed.
      setPendingAuth(result);
      router.replace({ pathname: '/(auth)/verify-email', params: { email: result.user.email } });
    } catch (e) {
      if (isApiError(e)) {
        setFormError(e.title);
      } else if (isNetworkError(e)) {
        setFormError(NETWORK_ERROR_MESSAGE);
      } else {
        setFormError('Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen backFallback="/(auth)/welcome">
      <AuthHeader title="Create your account" description="Start tracking pantry items with expiry alerts and fresh-use suggestions." compact />

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
      <View style={styles.row}>
        <View style={styles.half}>
          <TextField
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            error={errors.firstName}
          />
        </View>
        <View style={styles.half}>
          <TextField
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            error={errors.lastName}
          />
        </View>
      </View>

      <TextField
        label="Invite code (optional)"
        autoCapitalize="characters"
        value={referralCode ?? ''}
        onChangeText={(t) => {
          setCodeManuallySet(true);
          setReferralCode(t.trim().toUpperCase() || undefined);
        }}
        error={errors.referralCode}
      />
      {referralCode && !codeManuallySet ? (
        <Text style={{ color: theme.colors.textMuted, fontSize: theme.typeRamp.labelSmall.fontSize }}>
          Code applied from your invite link
        </Text>
      ) : null}

      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button
        testID="sign-up-submit"
        label="Create account"
        onPress={onSubmit}
        loading={loading}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
});
