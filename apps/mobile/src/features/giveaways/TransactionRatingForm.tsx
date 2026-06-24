// apps/mobile/src/features/giveaways/TransactionRatingForm.tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useRateTransaction } from '../../api/giveaways';
import { useTheme } from '../../theme/useTheme';

interface Props {
  giveawayId: string;
  onDone: () => void;
}

const STARS = [1, 2, 3, 4, 5];

export function TransactionRatingForm({ giveawayId, onDone }: Props) {
  const theme = useTheme();
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
      <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>Rate this transaction</Text>
      <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
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
              borderRadius: theme.radii.md,
              borderWidth: 2,
              borderColor: stars && s <= stars ? theme.colors.accent : theme.colors.border,
              backgroundColor: stars && s <= stars ? theme.colors.warning + '24' : theme.colors.bgElevated,
              minHeight: 44,
              minWidth: 44,
            }}
          >
            <Text style={{ fontSize: 20 }}>★</Text>
          </Pressable>
        ))}
      </View>

      <TextInput
        placeholder="Comment (optional)"
        placeholderTextColor={theme.colors.textMuted}
        value={comment}
        onChangeText={setComment}
        multiline
        style={{
          borderWidth: 1,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          padding: 12,
          color: theme.colors.text,
          backgroundColor: theme.colors.bgElevated,
          minHeight: 60,
          textAlignVertical: 'top',
        }}
      />

      {rate.isError && (
        <Text style={{ color: theme.colors.danger }}>
          {rate.error instanceof Error ? rate.error.message : 'Rating failed'}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        disabled={!stars || pending}
        onPress={submit}
        style={{
          padding: 14,
          borderRadius: theme.radii.pill,
          backgroundColor: stars && !pending ? theme.colors.accent : theme.colors.border,
          alignItems: 'center',
          minHeight: 48,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
          {pending ? 'Submitting…' : 'Submit rating'}
        </Text>
      </Pressable>
    </View>
  );
}
