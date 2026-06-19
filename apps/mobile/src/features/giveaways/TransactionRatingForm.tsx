// apps/mobile/src/features/giveaways/TransactionRatingForm.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRateTransaction } from '../../api/giveaways';

interface Props {
  giveawayId: string;
  onDone: () => void;
}

const STARS = [1, 2, 3, 4, 5];

export function TransactionRatingForm({ giveawayId, onDone }: Props) {
  const [stars, setStars] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const rate = useRateTransaction();
  const pending = rate.isPending;

  async function submit() {
    if (!stars) return;
    try {
      await rate.mutateAsync({ giveawayId, stars, comment: comment.trim() || undefined });
      onDone();
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <View style={{ gap: 16, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>Rate this transaction</Text>
      <Text style={{ color: '#6b7280', fontSize: 13 }}>
        Your rating will be hidden from the other party until they also submit theirs.
      </Text>

      <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
        {STARS.map((s) => (
          <Pressable
            key={s}
            accessibilityRole="button"
            accessibilityLabel={`star-${s}`}
            onPress={() => setStars(s)}
            style={{
              padding: 12,
              borderRadius: 8,
              borderWidth: 2,
              borderColor: stars && s <= stars ? '#d97706' : '#d1d5db',
              backgroundColor: stars && s <= stars ? '#fef3c7' : '#fff',
            }}
          >
            <Text style={{ fontSize: 20 }}>★</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        placeholder="Comment (optional)"
        placeholderTextColor="#9ca3af"
        value={comment}
        onChangeText={setComment}
        multiline
        style={{
          borderWidth: 1,
          borderColor: '#d1d5db',
          borderRadius: 8,
          padding: 12,
          color: '#111827',
          minHeight: 60,
          textAlignVertical: 'top',
        }}
      />

      {rate.isError && (
        <Text style={{ color: '#dc2626' }}>
          {rate.error instanceof Error ? rate.error.message : 'Rating failed'}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={!stars || pending}
        onPress={submit}
        style={{
          padding: 14,
          borderRadius: 8,
          backgroundColor: stars && !pending ? '#2563eb' : '#9ca3af',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>
          {pending ? 'Submitting…' : 'Submit rating'}
        </Text>
      </Pressable>
    </View>
  );
}
