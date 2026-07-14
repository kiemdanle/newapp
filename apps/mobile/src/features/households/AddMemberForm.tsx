import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { useAddMember } from '../../api/households';
import { useTheme } from '../../theme/useTheme';

interface Props {
  householdId: string;
  onAdded: () => void;
}

export function AddMemberForm({ householdId, onAdded }: Props) {
  const theme = useTheme();
  const [userId, setUserId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const addMember = useAddMember();

  const handleAdd = async () => {
    if (!userId.trim()) {
      setError('Enter a user ID');
      return;
    }
    setError(null);
    try {
      await addMember.mutateAsync({ householdId, input: { userId: userId.trim() } });
      setUserId('');
      onAdded();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const inputStyle = {
    color: theme.colors.text,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: theme.radii.md,
    padding: theme.spacing.md,
    minHeight: 52,
    backgroundColor: theme.colors.bgElevated,
    flex: 1,
  };

  return (
    <View style={{ gap: theme.spacing.sm, marginVertical: theme.spacing.md }}>
      <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Add member profile (by user ID)</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <TextInput
          testID="add-member-user-id"
          style={inputStyle}
          value={userId}
          onChangeText={setUserId}
          placeholder="User ID (UUID)"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
        />
        <Pressable
          testID="add-member-submit"
          accessibilityRole="button"
          onPress={handleAdd}
          disabled={addMember.isPending}
          style={{
            paddingHorizontal: theme.spacing.lg,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.primary,
            justifyContent: 'center',
            minHeight: 52,
          }}
        >
          <Text style={{ color: theme.colors.primaryFg, fontWeight: '600' }}>
            {addMember.isPending ? '...' : 'Add'}
          </Text>
        </Pressable>
      </View>
      {error ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
