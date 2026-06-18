import React from 'react';
import { Text } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';

export default function Browse() {
  const theme = useTheme();
  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Browse</Text>
      <Text style={{ color: theme.colors.textMuted }}>
        M1 will fill this in with the product catalog.
      </Text>
    </Screen>
  );
}
