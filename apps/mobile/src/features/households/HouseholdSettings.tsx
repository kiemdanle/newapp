import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import {
  useMyHouseholds,
  useHousehold,
  useHouseholdMembers,
  useCreateHousehold,
  useRenameHousehold,
  useRemoveMember,
  useDissolveHousehold,
} from '../../api/households';
import { useSessionStore } from '../../auth/session-store';
import { MemberRow } from './MemberRow';
import { AddMemberForm } from './AddMemberForm';
import { useTheme } from '../../theme/useTheme';

export function HouseholdSettings() {
  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const { data: myHh } = useMyHouseholds();
  const createHousehold = useCreateHousehold();
  const dissolveHousehold = useDissolveHousehold();

  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const households = myHh?.items ?? [];
  // Pick the first household the user owns, or fall back to the first membership.
  const activeHousehold = households[0] ?? null;
  const householdId = activeHousehold?.id ?? null;
  const myRole = activeHousehold?.myRole as 'owner' | 'member' | undefined;

  const { data: household } = useHousehold(householdId ?? undefined);
  const { data: membersList } = useHouseholdMembers(householdId ?? undefined);
  const renameHousehold = useRenameHousehold();
  const removeMember = useRemoveMember();

  const [renameText, setRenameText] = useState('');
  const [showAddMember, setShowAddMember] = useState(false);

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setCreateError('Household name is required');
      return;
    }
    setCreateError(null);
    try {
      await createHousehold.mutateAsync({ name: trimmed });
      setNewName('');
    } catch (e) {
      setCreateError((e as Error).message);
    }
  };

  const handleRename = async () => {
    if (!householdId || !renameText.trim()) return;
    try {
      await renameHousehold.mutateAsync({ id: householdId, input: { name: renameText.trim() } });
      setRenameText('');
    } catch {
      // The mutation exposes failure to the surrounding screen state.
    }
  };

  const handleDissolve = () => {
    if (!householdId) return;
    Alert.alert('Dissolve household', 'All shared records will revert to creators. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Dissolve',
        style: 'destructive',
        onPress: () => dissolveHousehold.mutate(householdId),
      },
    ]);
  };

  const handleRemoveMember = (memberId: string) => {
    if (!householdId) return;
    removeMember.mutate({ householdId, userId: memberId });
  };

  const handleLeave = () => {
    if (!householdId || !user) return;
    Alert.alert('Leave household', 'You will lose access to shared records.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => removeMember.mutate({ householdId, userId: user.id }),
      },
    ]);
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

  const members = membersList?.items ?? [];

  return (
    <View style={{ flex: 1, padding: theme.spacing.lg, gap: theme.spacing.md }}>
      {!activeHousehold ? (
        /* No household — show create form */
        <View>
          <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700', marginBottom: theme.spacing.sm }}>
            Share your pantry
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginBottom: theme.spacing.sm }}>
            Create a shared space for the people who cook and shop with you.
          </Text>
          <TextInput
            accessibilityLabel="Household name"
            testID="household-create-name"
            style={inputStyle}
            value={newName}
            onChangeText={setNewName}
            placeholder="Household name"
            placeholderTextColor={theme.colors.textMuted}
          />
          {createError ? <Text style={{ color: theme.colors.danger, fontSize: 12, marginTop: 4 }}>{createError}</Text> : null}
          <Pressable
            testID="household-create-submit"
            accessibilityRole="button"
            onPress={handleCreate}
            disabled={createHousehold.isPending}
            style={{
              backgroundColor: theme.colors.primary,
              padding: theme.spacing.md,
              borderRadius: theme.radii.pill,
              alignItems: 'center',
              marginTop: theme.spacing.sm,
              minHeight: 52,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.colors.primaryFg, fontWeight: '600' }}>
              {createHousehold.isPending ? 'Creating…' : 'Create Household'}
            </Text>
          </Pressable>
        </View>
      ) : (
        /* Existing household */
        <ScrollView style={{ flex: 1 }}>
          <Text style={{ color: theme.colors.text, fontSize: 24, fontWeight: '700' }}>
            {household?.name ?? activeHousehold?.name ?? 'Household'}
          </Text>

          {myRole === 'owner' ? (
            /* Owner: rename */
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginTop: theme.spacing.md }}>
              <TextInput
                accessibilityLabel="Rename household"
                testID="household-rename-input"
                style={inputStyle}
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Rename household"
                placeholderTextColor={theme.colors.textMuted}
              />
              <Pressable
                testID="household-rename-submit"
                accessibilityRole="button"
                onPress={handleRename}
                disabled={renameHousehold.isPending}
                style={{
                  backgroundColor: theme.colors.primary,
                  paddingHorizontal: theme.spacing.lg,
                  borderRadius: theme.radii.pill,
                  justifyContent: 'center', minHeight: 52,
                }}
              >
                <Text style={{ color: theme.colors.primaryFg, fontWeight: '600' }}>Rename</Text>
              </Pressable>
            </View>
          ) : null}

          {/* Members */}
          <Text style={{ color: theme.colors.textMuted, fontSize: 13, textTransform: 'uppercase', marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm }}>
            Members ({members.length})
          </Text>
          {members.map((m) => (
            <MemberRow
              key={m.userId}
              member={m}
              isCurrentUser={m.userId === user?.id}
              isOwner={m.role === 'owner'}
              canRemove={myRole === 'owner' && m.userId !== user?.id}
              onRemove={() => handleRemoveMember(m.userId)}
            />
          ))}

          {myRole === 'owner' ? (
            <>
              {showAddMember ? (
                <AddMemberForm householdId={householdId!} onAdded={() => setShowAddMember(false)} />
              ) : (
                <Pressable
                  testID="household-add-member"
                  accessibilityRole="button"
                  onPress={() => setShowAddMember(true)}
                  style={{
                    marginTop: theme.spacing.sm,
                    padding: theme.spacing.sm,
                    borderRadius: theme.radii.pill,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                    alignItems: 'center', minHeight: 52, justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: theme.colors.primary }}>+ Add member</Text>
                </Pressable>
              )}

              {/* Owner actions */}
              <Pressable
                testID="household-dissolve"
                accessibilityRole="button"
                onPress={handleDissolve}
                disabled={dissolveHousehold.isPending}
                style={{
                  marginTop: theme.spacing.xl,
                  padding: theme.spacing.md,
                  backgroundColor: theme.colors.danger,
                  alignItems: 'center', minHeight: 52, justifyContent: 'center', borderRadius: theme.radii.pill,
                }}
              >
                <Text style={{ color: theme.colors.textInverse, fontWeight: '600' }}>
                  {dissolveHousehold.isPending ? 'Dissolving…' : 'Dissolve Household'}
                </Text>
              </Pressable>
            </>
          ) : (
            /* Member action: leave */
            <Pressable
              testID="household-leave"
              accessibilityRole="button"
              onPress={handleLeave}
              disabled={removeMember.isPending}
              style={{
                marginTop: theme.spacing.xl,
                padding: theme.spacing.md,
                borderWidth: 1,
                borderColor: theme.colors.danger,
                alignItems: 'center', minHeight: 52, justifyContent: 'center', borderRadius: theme.radii.pill,
              }}
            >
              <Text style={{ color: theme.colors.danger, fontWeight: '600' }}>
                {removeMember.isPending ? 'Leaving…' : 'Leave Household'}
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}
    </View>
  );
}
