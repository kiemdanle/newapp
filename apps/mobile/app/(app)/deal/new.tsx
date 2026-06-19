// apps/mobile/app/(app)/deal/new.tsx
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useProductSearch } from '@/api/products';
import { DealForm } from '@/features/deals/DealForm';

/** Post-a-deal screen. Picks a product via M1 product search, then renders DealForm. */
export default function NewDealScreen() {
  const [q, setQ] = useState('');
  const [product, setProduct] = useState<{ id: string; name: string } | null>(null);
  const { data: results, isLoading } = useProductSearch(q, q.length > 0);

  if (product) {
    return (
      <>
        <Stack.Screen options={{ title: 'Post a deal' }} />
        <View style={{ flex: 1 }}>
          <DealForm product={product} onDone={() => router.back()} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Find product' }} />
      <View style={{ flex: 1, padding: 16 }}>
        <TextInput
          placeholder="Search for a product…"
          placeholderTextColor="#9ca3af"
          value={q}
          onChangeText={setQ}
          autoFocus
          style={{
            borderWidth: 1,
            borderColor: '#d1d5db',
            borderRadius: 8,
            padding: 12,
            color: '#111827',
            marginBottom: 12,
          }}
        />
        {isLoading && <ActivityIndicator />}
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
                borderBottomColor: '#f3f4f6',
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '500' }}>{item.name}</Text>
              {item.brand ? (
                <Text style={{ color: '#6b7280', fontSize: 12 }}>{item.brand}</Text>
              ) : null}
            </Pressable>
          )}
          ListEmptyComponent={
            q.length > 0 && !isLoading ? (
              <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 24 }}>
                No products found.
              </Text>
            ) : null
          }
        />
      </View>
    </>
  );
}
