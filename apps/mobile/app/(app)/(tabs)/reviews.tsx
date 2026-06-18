import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';

export default function Reviews() {
  const theme = useTheme();
  return (
    <Screen>
      <Text style={{ fontSize: theme.typeRamp.headlineMedium.fontSize, fontWeight: theme.typeRamp.headlineMedium.fontWeight as any, color: theme.colors.text }}>Reviews</Text>
      <Text style={{ color: theme.colors.textMuted }}>
        M2 will fill this in with reviews and votes.
      </Text>
    </Screen>
  );
}
