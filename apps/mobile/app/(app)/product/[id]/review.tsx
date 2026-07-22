import React, { useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { Screen } from '../../../../src/components/Screen';
import { Button } from '../../../../src/components/Button';
import { TextField } from '../../../../src/components/TextField';
import { ErrorText } from '../../../../src/components/ErrorText';
import { useTheme } from '../../../../src/theme/useTheme';

export default function ProductReview() {
  const theme = useTheme();
  const route = useRoute();
  const { id } = route.params as { id: string };
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit() {
    setError(null);
    if (rating < 1 || rating > 5) {
      setError('Select a rating (1–5).');
      return;
    }
    // TODO: wire to API when M2 backend lands
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Screen>
        <Text
          style={{
            color: theme.colors.text,
            fontSize: theme.typeRamp.headlineSmall.fontSize,
            fontWeight: theme.typeRamp.headlineSmall.fontWeight as any,
          }}
        >
          Review submitted
        </Text>
        <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
          Thanks! Your review will appear after moderation.
        </Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: theme.typeRamp.headlineMedium.fontSize,
          fontWeight: theme.typeRamp.headlineMedium.fontWeight as any,
        }}
      >
        Write a review
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
        Product {id}
      </Text>

      {/* Star rating */}
      <View
        style={{
          flexDirection: 'row',
          gap: theme.spacing.sm,
          marginTop: theme.spacing.lg,
          marginBottom: theme.spacing.md,
        }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Rating"
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
            accessibilityState={{ selected: star <= rating }}
            onPress={() => setRating(star)}
            style={{
              width: 48,
              height: 48,
              borderRadius: theme.radii.sm,
              backgroundColor:
                star <= rating ? theme.colors.accent : theme.colors.bgElevated,
              borderWidth: 1,
              borderColor:
                star <= rating ? theme.colors.accent : theme.colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text
              style={{
                color:
                  star <= rating ? theme.colors.textInverse : theme.colors.textMuted,
                fontSize: theme.typeRamp.titleSmall.fontSize,
              }}
            >
              {star}
            </Text>
          </Pressable>
        ))}
      </View>

      <TextField
        label="Your review (optional)"
        value={body}
        onChangeText={setBody}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      <Button
        testID="review-submit"
        label="Submit review"
        onPress={onSubmit}
      />
    </Screen>
  );
}
