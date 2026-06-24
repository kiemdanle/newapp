// apps/mobile/src/features/giveaways/ClaimButton.tsx
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useClaimGiveaway } from '../../api/giveaways';
import { useTheme } from '../../theme/useTheme';

interface Props {
  giveawayId: string;
  disabled?: boolean;
}

export function ClaimButton({ giveawayId, disabled }: Props) {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);
  const [note, setNote] = useState('');
  const claim = useClaimGiveaway();
  const pending = claim.isPending;

  async function submit() {
    try {
      await claim.mutateAsync({ giveawayId, pickupNote: note.trim() || undefined });
      setVisible(false);
      setNote('');
    } catch {
      // error handled by mutation state
    }
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="claim-button"
        disabled={disabled || pending}
        onPress={() => setVisible(true)}
        style={{
          padding: 12,
          borderRadius: theme.radii.pill,
          backgroundColor: disabled ? theme.colors.border : theme.colors.accent,
          alignItems: 'center',
          minHeight: 44,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
          {pending ? 'Claiming…' : 'Claim'}
        </Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: theme.colors.bgElevated, padding: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text }}>Pickup note</Text>
            <TextInput
              placeholder="When can you pick up? (optional)"
              placeholderTextColor={theme.colors.textMuted}
              value={note}
              onChangeText={setNote}
              multiline
              style={{
                borderWidth: 1,
                borderColor: theme.colors.border,
                borderRadius: theme.radii.md,
                padding: 12,
                color: theme.colors.text,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
            {claim.isError && (
              <Text style={{ color: theme.colors.danger }}>
                {claim.error instanceof Error ? claim.error.message : 'Claim failed'}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setVisible(false)}
                disabled={pending}
                style={{ flex: 1, padding: 12, borderRadius: theme.radii.md, backgroundColor: theme.colors.border, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={pending}
                style={{ flex: 1, padding: 12, borderRadius: theme.radii.md, backgroundColor: theme.colors.accent, alignItems: 'center', minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
