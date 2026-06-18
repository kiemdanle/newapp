import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Text } from 'react-native';
import { registerSchema } from '@expyrico/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { useSessionStore } from '../../src/auth/session-store';
import { isApiError } from '../../src/api/errors';
import { useTheme } from '../../src/theme/useTheme';

export default function SignUp() {
  const router = useRouter();
  const theme = useTheme();
  const signIn = useSessionStore((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const input = { email, password, firstName, lastName };
    const errs = fieldErrors(registerSchema, input);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      const result = await authEndpoints.register(input);
      await signIn(result);
      router.replace('/(auth)/verify-email');
    } catch (e) {
      setFormError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>
        Create your account
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
      <TextField
        label="First name"
        value={firstName}
        onChangeText={setFirstName}
        error={errors.firstName}
      />
      <TextField
        label="Last name"
        value={lastName}
        onChangeText={setLastName}
        error={errors.lastName}
      />
      {formError ? <ErrorText>{formError}</ErrorText> : null}
      <Button testID="sign-up-submit" label="Create account" onPress={onSubmit} loading={loading} />
    </Screen>
  );
}
