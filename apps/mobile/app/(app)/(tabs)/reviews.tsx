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
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.primaryDark }}>COMMUNITY</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Helpful reviews</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          Keep the products you love close and share what is worth buying again.
        </Text>
      </View>
      <EmptyState
        icon="chatbubbles"
        title="Your product notes will grow here"
        body="When you review products, this is where your trusted picks and helpful community notes appear."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginBottom: 6 },
});
