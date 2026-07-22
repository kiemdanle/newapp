import { Pressable, Text, View } from 'react-native';
import type { HouseholdMember } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';

interface Props {
  member: HouseholdMember;
  isCurrentUser: boolean;
  isOwner: boolean;
  canRemove: boolean;
  onRemove: () => void;
}

export function MemberRow({ member, isCurrentUser, isOwner, canRemove, onRemove }: Props) {
  const theme = useTheme();
  const name = member.user?.firstName ?? member.userId.slice(0, 8);
  const roleLabel = member.role === 'owner' ? 'Owner' : 'Member';
  const selfLabel = isCurrentUser ? ' (you)' : '';

  return (
    <View
      testID={`member-row-${member.userId}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: theme.spacing.sm,
        minHeight: 60,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
      }}
    >
      <View>
        <Text style={{ color: theme.colors.text, fontSize: 15, fontWeight: '500' }}>
          {name}{selfLabel}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{roleLabel}</Text>
      </View>
      {canRemove ? (
        <Pressable
          testID={`member-remove-${member.userId}`}
          accessibilityRole="button"
          onPress={onRemove}
          style={{
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.xs,
            borderRadius: theme.radii.sm,
            backgroundColor: theme.colors.danger,
            minHeight: 48,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: theme.colors.textInverse, fontSize: 12, fontWeight: '600' }}>Remove</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
