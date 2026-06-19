// apps/mobile/app/(app)/giveaway/new.tsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useCreateGiveaway } from '@/api/giveaways';

export default function NewGiveawayScreen() {
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
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    color: '#111827',
  } as const;

  return (
    <>
      <Stack.Screen options={{ title: 'New giveaway' }} />
      <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ gap: 12 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>List a free item</Text>
        <TextInput
          placeholder="Title *"
          placeholderTextColor="#9ca3af"
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          editable={!pending}
          style={field}
        />
        <TextInput
          placeholder="Description (optional)"
          placeholderTextColor="#9ca3af"
          value={description}
          onChangeText={setDescription}
          multiline
          maxLength={2000}
          editable={!pending}
          style={[field, { minHeight: 80, textAlignVertical: 'top' }]}
        />
        <TextInput
          placeholder="Pickup location *"
          placeholderTextColor="#9ca3af"
          value={locationText}
          onChangeText={setLocation}
          maxLength={160}
          editable={!pending}
          style={field}
        />
        {error ? <Text style={{ color: '#dc2626' }}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={pending}
          onPress={submit}
          style={{
            padding: 14,
            borderRadius: 8,
            backgroundColor: pending ? '#9ca3af' : '#2563eb',
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>
            {pending ? 'Creating…' : 'List giveaway'}
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
