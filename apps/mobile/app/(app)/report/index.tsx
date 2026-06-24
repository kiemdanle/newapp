// apps/mobile/app/(app)/report/index.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme/useTheme';

const REASONS: string[] = ['spam', 'inappropriate', 'misleading', 'other'];

/** Lightweight report screen — reused by reviews (M2), products (M2), and deals (M5). */
export default function ReportScreen() {
  const theme = useTheme();
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
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: theme.colors.bg }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: theme.colors.text }}>Thanks for reporting.</Text>
          <Pressable
            onPress={() => router.back()}
            style={{ marginTop: 24, padding: 12, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accent, minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Report' }} />
      <View style={{ flex: 1, padding: 16, gap: 16, backgroundColor: theme.colors.bg }}>
        <Text style={{ fontSize: 16, color: theme.colors.text }}>
          Report this {targetType}:
        </Text>
        {REASONS.map((r) => (
          <Pressable
            key={r}
            accessibilityRole="button"
            onPress={() => setReason(r)}
            style={{
              padding: 12,
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: reason === r ? theme.colors.primary : theme.colors.border,
              backgroundColor: reason === r ? theme.colors.bgGlass : theme.colors.bgElevated,
              minHeight: 44,
            }}
          >
            <Text style={{ color: reason === r ? theme.colors.primary : theme.colors.text, fontWeight: '600', textTransform: 'capitalize' }}>
              {r}
            </Text>
          </Pressable>
        ))}
        {error && <Text style={{ color: theme.colors.danger }}>{error}</Text>}
        <Pressable
          accessibilityRole="button"
          disabled={!reason || submitting}
          onPress={submit}
          style={{
            padding: 14,
            borderRadius: theme.radii.pill,
            backgroundColor: reason && !submitting ? theme.colors.accent : theme.colors.border,
            alignItems: 'center',
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
            {submitting ? 'Submitting…' : 'Submit'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}
