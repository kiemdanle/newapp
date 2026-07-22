import React, { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { Button } from '../../../src/components/Button';
import { ErrorText } from '../../../src/components/ErrorText';
import { registerPasskey } from '../../../src/auth/passkey';
import { isApiError } from '../../../src/api/errors';
import { useTheme } from '../../../src/theme/useTheme';

export default function AddPasskey() {
  const theme = useTheme();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onAdd() {
    setError(null);
    setLoading(true);
    try {
      await registerPasskey();
      setDone(true);
    } catch (e) {
      setError(
        isApiError(e)
          ? e.title
          : e instanceof Error && e.message
            ? e.message
            : 'Could not add a passkey',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Text style={{ fontSize: theme.typeRamp.headlineSmall.fontSize, fontWeight: theme.typeRamp.headlineSmall.fontWeight as any, color: theme.colors.text }}>
        Add a passkey
      </Text>
      <Text style={{ color: theme.colors.textMuted, lineHeight: 22 }}>
        Use Face ID, Touch ID, or your device PIN to sign in next time — no password needed.
      </Text>
      {done ? (
        <Text style={{ color: theme.colors.success }}>
          Passkey added. You can now sign in with it.
        </Text>
      ) : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
      {!done ? (
        <Button
          testID="add-passkey-submit"
          label="Create a passkey"
          onPress={onAdd}
          loading={loading}
        />
      ) : null}
    </Screen>
  );
}
