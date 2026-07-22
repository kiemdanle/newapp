import React, { useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../src/navigation/AuthNavigator';
import { resetPasswordSchema } from '@expyrico/shared';
import { Screen } from '../../src/components/Screen';
import { TextField } from '../../src/components/TextField';
import { Button } from '../../src/components/Button';
import { ErrorText } from '../../src/components/ErrorText';
import { fieldErrors } from '../../src/lib/validate';
import { authEndpoints } from '../../src/api/endpoints';
import { isApiError } from '../../src/api/errors';
import { AuthHeader } from '../../src/components/AuthHeader';

export default function ResetPassword() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const route = useRoute();
  const { ticket } = route.params as { ticket?: string };
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    const resetTicket = ticket ?? '';
    const errs = fieldErrors(resetPasswordSchema, { resetTicket, password });
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await authEndpoints.resetPassword(resetTicket, password);
      setDone(true);
    } catch (e) {
      setError(isApiError(e) ? e.title : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Screen backFallback="/(auth)/sign-in">
        <AuthHeader icon="checkmark-circle-outline" title="Password reset" description="Sign in with your new password." />
        <Button label="Sign in" onPress={() => navigation.replace('SignIn')} />
      </Screen>
    );
  }

  return (
    <Screen backFallback="/(auth)/sign-in">
      <AuthHeader icon="lock-closed-outline" title="Choose a new password" description="Use a strong, memorable password to protect your pantry." />
      {!ticket ? (
        <>
          <ErrorText>Your reset session expired. Start over to get a new code.</ErrorText>
          <Button
            testID="reset-start-over"
            label="Start over"
            onPress={() => navigation.replace('ForgotPassword')}
          />
        </>
      ) : (
        <>
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
          />
        </>
      )}
    </Screen>
  );
}
