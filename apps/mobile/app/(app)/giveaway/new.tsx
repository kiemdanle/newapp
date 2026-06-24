// apps/mobile/app/(app)/giveaway/new.tsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useCreateGiveaway } from '@/api/giveaways';
import { useTheme } from '@/theme/useTheme';

export default function NewGiveawayScreen() {
  const theme = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationText, setLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateGiveaway();
  const pending = create.isPending;

  async function submit() {
    setError(null);
    if (!title.trim() || !locationText.trim()) {
      setError('Title and location are required.');
      return;
    }
    try {
      const result = await create.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        locationText: locationText.trim(),
      });
      router.replace(`/giveaway/${result.id}`);
    } catch {
      setError('Could not create giveaway.');
    }
  }

  const field = {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.md,
    padding: 12,
    color: theme.colors.text,
    backgroundColor: theme.colors.bgElevated,
  } as const;

  return (
    <>
      <Stack.Screen options={{ title: 'New giveaway' }} />
      <ScrollView style={{ flex: 1, padding: 16, backgroundColor: theme.colors.bg }} contentContainerStyle={{ gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text }}>List a free item</Text>
        <TextInput
          placeholder="Title *"
          placeholderTextColor={theme.colors.textMuted}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          editable={!pending}
          style={field}
        />
        <TextInput
          placeholder="Description (optional)"
          placeholderTextColor={theme.colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          editable={!pending}
          style={[field, { minHeight: 80, textAlignVertical: 'top' }]}
        />
        <TextInput
          placeholder="Pickup location *"
          placeholderTextColor={theme.colors.textMuted}
          value={locationText}
          onChangeText={setLocation}
          maxLength={160}
          editable={!pending}
          style={field}
        />
        {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={submit}
          style={{
            padding: 14,
            borderRadius: theme.radii.pill,
            backgroundColor: pending ? theme.colors.border : theme.colors.accent,
            alignItems: 'center',
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
            {pending ? 'Creating…' : 'List giveaway'}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
