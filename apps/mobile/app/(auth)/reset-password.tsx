import React, { useState } from 'react';
import { Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { resetPasswordSchema } from '@expyrico/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function ResetPassword() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    const token = params.token ?? '';
    const errs = fieldErrors(resetPasswordSchema, { token, password });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await authEndpoints.resetPassword(token, password);
      setDone(true);
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Screen>
        <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text }}>
          Password reset
        </Text>
        <Text style={{ color: theme.colors.textMuted }}>Sign in with your new password.</Text>
        <Button label="Sign in" onPress={() => router.replace('/(auth)/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>
        Choose a new password
      </Text>
      {!params.token ? (
        <ErrorText>This link is missing its token. Request a new one.</ErrorText>
      ) : null}
      <TextField
        label="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button
        testID="reset-submit"
        label="Save password"
        onPress={onSubmit}
        loading={loading}
        disabled={!params.token}
      />
    </Screen>
  );
}
