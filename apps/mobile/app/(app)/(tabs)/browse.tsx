import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { useTheme } from '../../../src/theme/useTheme';
import { EmptyState } from '../../../src/components/EmptyState';

export default function Browse() {
  const theme = useTheme();
  return (
    <Screen>
      <View style={styles.header}>
        <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: theme.colors.primaryDark }}>DISCOVER</Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Browse pantry ideas</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          Product lookup and pantry inspiration will live here.
        </Text>
      </View>
      <EmptyState
        icon="search"
        title="Your shelf, made simpler"
        body="Scan an item from Home to start building a product library you can trust."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginBottom: 6 },
});
