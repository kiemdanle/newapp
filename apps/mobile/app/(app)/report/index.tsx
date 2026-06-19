// apps/mobile/app/(app)/report/index.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';

const REASONS: string[] = ['spam', 'inappropriate', 'misleading', 'other'];

/** Lightweight report screen — reused by reviews (M2), products (M2), and deals (M5). */
export default function ReportScreen() {
  const { targetType, targetId } = useLocalSearchParams<{ targetType: string; targetId: string }>();
  const [reason, setReason] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!reason) return;
    setSubmitting(true);
    setError(null);
    try {
      const { apiClient } = await import('@/api/client');
      await apiClient.post('/reports', { targetType, targetId, reason });
      setDone(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Report failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <>
        <Stack.Screen options={{ title: 'Reported' }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#111827' }}>Thanks for reporting.</Text>
          <Pressable
            onPress={() => router.back()}
            style={{ marginTop: 24, padding: 12, borderRadius: 8, backgroundColor: '#2563eb' }}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Report' }} />
      <View style={{ flex: 1, padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 16, color: '#374151' }}>
          Report this {targetType}:
        </Text>
        {REASONS.map((r) => (
          <Pressable
            key={r}
            accessibilityRole="button"
            onPress={() => setReason(r)}
            style={{
              padding: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: reason === r ? '#2563eb' : '#d1d5db',
              backgroundColor: reason === r ? '#eff6ff' : '#fff',
            }}
          >
            <Text style={{ color: reason === r ? '#2563eb' : '#374151', fontWeight: '500', textTransform: 'capitalize' }}>
              {r}
            </Text>
          </Pressable>
        ))}
        {error && <Text style={{ color: '#dc2626' }}>{error}</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={!reason || submitting}
          onPress={submit}
          style={{
            padding: 14,
            borderRadius: 8,
            backgroundColor: reason && !submitting ? '#2563eb' : '#9ca3af',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
