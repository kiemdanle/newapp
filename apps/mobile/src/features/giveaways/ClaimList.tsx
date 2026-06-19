// apps/mobile/src/features/giveaways/ClaimList.tsx
import { FlatList, Pressable, Text, View } from 'react-native';
import type { Claim } from '@expyrico/shared';
import { useReputation } from '../../api/reputation';

interface Props {
  claims: Claim[];
  isGiver: boolean;
  selectedRecipientId: string | null;
  onSelect?: (claim: Claim) => void;
  selecting?: boolean;
}

export function ClaimList({ claims, isGiver, selectedRecipientId, onSelect, selecting }: Props) {
  if (claims.length === 0) {
    return (
      <Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 24 }}>
        No claims yet.
      </Text>
    );
  }

  return (
    <FlatList
      data={claims}
      keyExtractor={(c) => c.id}
      renderItem={({ item }) => {
        const isSelected = item.status === 'selected' || item.claimerUserId === selectedRecipientId;
        return (
          <View
            style={{
              padding: 12,
              marginVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: isSelected ? '#2563eb' : '#d1d5db',
              backgroundColor: isSelected ? '#eff6ff' : '#fff',
            }}
          >
            <Text style={{ fontWeight: '600', color: '#111827' }}>
              {item.claimer?.firstName ?? 'User'}
            </Text>
            {item.claimer && <ClaimerReputation userId={item.claimer.id} />}
            {/* pickupNote: only visible for selected claims or own claim (API enforces privacy) */}
            {isSelected && item.pickupNote && (
              <Text style={{ color: '#374151', marginTop: 4, fontSize: 13 }}>
                Note: {item.pickupNote}
              </Text>
            )}
            <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 4 }}>
              {new Date(item.createdAt).toLocaleDateString()}
            </Text>
            {isGiver && !selectedRecipientId && item.status === 'requested' && onSelect && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`select-claim-${item.id}`}
                disabled={selecting}
                onPress={() => onSelect(item)}
                style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 6,
                  backgroundColor: selecting ? '#9ca3af' : '#2563eb',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
                  {selecting ? 'Selecting…' : 'Select as recipient'}
                </Text>
              </Pressable>
            )}
          </View>
        );
      }}
    />
  );
}

function ClaimerReputation({ userId }: { userId: string }) {
  const { data: rep } = useReputation(userId);
  if (!rep) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
      {rep.recipientRatingAvg != null && (
        <Text style={{ color: '#d97706', fontSize: 12 }}>
          ★ {rep.recipientRatingAvg.toFixed(1)}
        </Text>
      )}
      <Text style={{ color: '#6b7280', fontSize: 12 }}>
        {rep.transactionCount} tx
      </Text>
    </View>
  );
}
