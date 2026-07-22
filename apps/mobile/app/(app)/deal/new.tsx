// apps/mobile/app/(app)/deal/new.tsx
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProductSearch } from '@/api/products';
import { DealForm } from '@/features/deals/DealForm';
import { useTheme } from '@/theme/useTheme';
import type { AppNavigationProp } from '@/navigation/AppNavigator';

/** Post-a-deal screen. Picks a product via M1 product search, then renders DealForm. */
export default function NewDealScreen() {
  const theme = useTheme();
  const navigation = useNavigation<AppNavigationProp>();
  const [q, setQ] = useState('');
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null);
  const { data: results, isLoading } = useProductSearch(q, q.length > 0);

  if (product) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
        <DealForm product={product} onDone={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: theme.colors.bg }}>
      <TextInput
        placeholder="Search for a product…"
        placeholderTextColor={theme.colors.textMuted}
        value={q}
        onChangeText={setQ}
        autoFocus
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          padding: 12,
          color: theme.colors.text,
          backgroundColor: theme.colors.bgElevated,
          minHeight: 52,
          marginBottom: 12,
        }}
      />
      {isLoading && <ActivityIndicator color={theme.colors.primary} />}
      <FlatList
        data={results ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => setProduct({ id: item.id, name: item.name })}
            style={{
              padding: 12,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
              minHeight: 52,
            }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '500' }}>{item.name}</Text>
            {item.brand ? (
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{item.brand}</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          q.length > 0 && !isLoading ? (
            <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 }}>
              No products found.
            </Text>
          ) : null
        }
      />
    </View>
  );
}
