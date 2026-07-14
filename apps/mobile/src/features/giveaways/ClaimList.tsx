// apps/mobile/src/features/giveaways/ClaimList.tsx
import { FlatList, Pressable, Text, View } from 'react-native';
import type { Claim } from '@expyrico/shared';
import { useReputation } from '../../api/reputation';
import { useTheme } from '../../theme/useTheme';

interface Props {
  claims: Claim[];
  isGiver: boolean;
  selectedRecipientId: string | null;
  onSelect?: (claim: Claim) => void;
  selecting?: boolean;
}

export function ClaimList({ claims, isGiver, selectedRecipientId, onSelect, selecting }: Props) {
  const theme = useTheme();
  if (claims.length === 0) {
    return (
      <Text style={{ color: theme.colors.textMuted, textAlign: 'center', marginTop: 24 }}>
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
              borderRadius: theme.radii.md,
              borderWidth: 1,
              borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              backgroundColor: isSelected ? theme.colors.bgGlass : theme.colors.bgElevated,
            }}
          >
            <Text style={{ fontWeight: '600', color: theme.colors.text }}>
              {item.claimer?.firstName ?? 'User'}
            </Text>
            {item.claimer && <ClaimerReputation userId={item.claimer.id} />}
            {/* pickupNote: only visible for selected claims or own claim (API enforces privacy) */}
            {isSelected && item.pickupNote && (
              <Text style={{ color: theme.colors.text, marginTop: 4, fontSize: 13 }}>
                Note: {item.pickupNote}
              </Text>
            )}
            <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 4 }}>
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
                  borderRadius: theme.radii.md,
                  backgroundColor: selecting ? theme.colors.border : theme.colors.accent,
                  alignItems: 'center',
                  minHeight: 52,
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 13 }}>
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
  const theme = useTheme();
  const { data: rep } = useReputation(userId);
  if (!rep) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 8, marginTop: 2 }}>
      {rep.recipientRatingAvg != null && (
        <Text style={{ color: theme.colors.accent, fontSize: 12 }}>
          ★ {rep.recipientRatingAvg.toFixed(1)}
        </Text>
      )}
      <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
        {rep.transactionCount} tx
      </Text>
    </View>
  );
}
