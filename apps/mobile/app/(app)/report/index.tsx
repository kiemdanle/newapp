// apps/mobile/app/(app)/report/index.tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '@/theme/useTheme';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';

const REASONS: string[] = ['spam', 'abuse', 'incorrect', 'other'];

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
        <Screen>
          <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
            <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
              <Text style={{ fontSize: 22, fontWeight: '700', color: theme.colors.text }}>Thanks for keeping Expyrico useful.</Text>
              <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>We will review this report and take action when needed.</Text>
              <Button label="Back" onPress={() => router.back()} />
            </Card>
          </View>
        </Screen>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Report' }} />
      <Screen>
        <Text style={{ fontSize: 24, fontWeight: '700', color: theme.colors.text }}>Report {targetType}</Text>
        <Text style={{ color: theme.colors.textMuted }}>Choose the reason that best explains the problem.</Text>
        <Card>
          {REASONS.map((r) => (
            <Pressable key={r} accessibilityRole="radio" accessibilityState={{ selected: reason === r }} onPress={() => setReason(r)} style={{ minHeight: 52, justifyContent: 'center', paddingHorizontal: 14, borderRadius: theme.radii.md, borderWidth: 1, borderColor: reason === r ? theme.colors.primary : theme.colors.border, backgroundColor: reason === r ? theme.colors.bgGlass : 'transparent' }}>
              <Text style={{ color: reason === r ? theme.colors.primary : theme.colors.text, fontWeight: '700', textTransform: 'capitalize' }}>{r}</Text>
            </Pressable>
          ))}
        </Card>
        {error && <Text style={{ color: theme.colors.danger }}>{error}</Text>}
        <Button label={submitting ? 'Submitting…' : 'Submit report'} loading={submitting} disabled={!reason} onPress={submit} />
      </Screen>
    </>
  );
}
