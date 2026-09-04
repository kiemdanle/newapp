import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useAddMember } from '../../api/households';
import { useTheme } from '../../theme/useTheme';

interface Props {
  householdId: string;
  onAdded: () => void;
}

export function AddMemberForm({ householdId, onAdded }: Props) {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const addMember = useAddMember();

  const handleAdd = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('Enter an email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    try {
      await addMember.mutateAsync({ householdId, input: { email: trimmed } });
      setEmail('');
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
      <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>Add member by email address</Text>
      <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
        <TextInput
          accessibilityLabel="User email"
          testID="add-member-email-input"
          style={inputStyle}
          value={email}
          onChangeText={(val) => {
            setEmail(val);
            if (error) setError(null);
          }}
          placeholder="partner@example.com"
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
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
            alignItems: 'center',
            minHeight: 52,
            minWidth: 72,
          }}
        >
          {addMember.isPending ? (
            <ActivityIndicator size="small" color={theme.colors.primaryFg} />
          ) : (
            <Text style={{ color: theme.colors.primaryFg, fontWeight: '600' }}>Add</Text>
          )}
        </Pressable>
      </View>
      {error ? <Text style={{ color: theme.colors.danger, fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}
