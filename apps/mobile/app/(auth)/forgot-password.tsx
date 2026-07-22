import React, { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../src/navigation/AuthNavigator';
import { forgotPasswordSchema } from '@expyrico/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { isApiError } from '../../src/api/errors';
import { AuthHeader } from '../../src/components/AuthHeader';

export default function ForgotPassword() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    const errs = fieldErrors(forgotPasswordSchema, { email });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await authEndpoints.forgotPassword(email);
      // Always advance to the code screen — the server returns 204 whether or not
      // the account exists, so the screen must not reveal existence either.
      navigation.navigate('VerifyResetCode', { email });
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen backFallback="/(auth)/sign-in">
      <AuthHeader icon="key-outline" title="Reset your password" description="Enter your email and we'll send a 6-digit reset code." />
      <TextField
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button testID="forgot-submit" label="Send reset code" onPress={onSubmit} loading={loading} />
      <Button label="Cancel" variant="ghost" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
