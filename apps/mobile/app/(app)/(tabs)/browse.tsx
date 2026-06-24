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
        <Text style={{ fontSize: 28, fontWeight: '700', color: theme.colors.text }}>Browse</Text>
        <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
          Search product notes, expiry patterns, and pantry staples when catalog data is ready.
        </Text>
      </View>
      <EmptyState
        icon="search"
        title="Catalog coming next"
        body="For now, scan from Home to add items. Browse will become the product catalog and lookup hub."
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: 6, marginBottom: 6 },
});
