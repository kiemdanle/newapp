// apps/mobile/src/features/giveaways/ClaimButton.tsx
import { useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useClaimGiveaway } from '../../api/giveaways';

interface Props {
  giveawayId: string;
  disabled?: boolean;
}

export function ClaimButton({ giveawayId, disabled }: Props) {
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
          borderRadius: 8,
          backgroundColor: disabled ? '#d1d5db' : '#2563eb',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>
          {pending ? 'Claiming…' : 'Claim'}
        </Text>
      </Pressable>

      <Modal visible={visible} animationType="slide" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <View style={{ backgroundColor: '#fff', padding: 24, borderTopLeftRadius: 16, borderTopRightRadius: 16, gap: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#111827' }}>Pickup note</Text>
            <TextInput
              placeholder="When can you pick up? (optional)"
              placeholderTextColor="#9ca3af"
              value={note}
              onChangeText={setNote}
              multiline
              style={{
                borderWidth: 1,
                borderColor: '#d1d5db',
                borderRadius: 8,
                padding: 12,
                color: '#111827',
                minHeight: 80,
                textAlignVertical: 'top',
              }}
            />
            {claim.isError && (
              <Text style={{ color: '#dc2626' }}>
                {claim.error instanceof Error ? claim.error.message : 'Claim failed'}
              </Text>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setVisible(false)}
                disabled={pending}
                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#e5e7eb', alignItems: 'center' }}
              >
                <Text style={{ color: '#374151', fontWeight: '500' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={pending}
                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#2563eb', alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
