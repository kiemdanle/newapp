import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';
import { EmptyState } from '../../../src/components/EmptyState';

export default function Reviews() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Reviews</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          Product quality signals will live here once community reviews are enabled.
        </Text>
      </View>
      <EmptyState
        icon="chatbubbles"
        title="Reviews coming next"
        body="After product pages launch, this tab will show helpful votes and trusted product notes."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginBottom: 6 },
});
