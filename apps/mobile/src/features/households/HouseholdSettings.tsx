import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert, Switch } from 'react-native';
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
import { HouseholdInviteCard } from './HouseholdInviteCard';
import { JoinHouseholdModal } from './JoinHouseholdModal';
import { readPendingHouseholdInviteCode, clearPendingHouseholdInviteCode } from './pendingHouseholdInviteStore';
import { usePantryScope } from '../../store/pantryScope';

export interface HouseholdSettingsProps {
  initialJoinCode?: string | null;
}

export function HouseholdSettings({ initialJoinCode }: HouseholdSettingsProps = {}) {

  const theme = useTheme();
  const user = useSessionStore((s) => s.user);
  const { data: myHh } = useMyHouseholds();
  const createHousehold = useCreateHousehold();
  const dissolveHousehold = useDissolveHousehold();
  const { defaultHouseholdId, setDefaultHouseholdId } = usePantryScope();
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
  const [showJoinModal, setShowJoinModal] = useState(Boolean(initialJoinCode));
  const [joinModalCode, setJoinModalCode] = useState<string | null>(initialJoinCode ?? null);

  useEffect(() => {
    if (initialJoinCode) {
      setJoinModalCode(initialJoinCode);
      setShowJoinModal(true);
    } else {
      void readPendingHouseholdInviteCode().then((code) => {
        if (code) {
          setJoinModalCode(code);
          setShowJoinModal(true);
          void clearPendingHouseholdInviteCode();
        }
      });
    }
  }, [initialJoinCode]);

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
        onPress: () => {
          if (defaultHouseholdId === householdId) setDefaultHouseholdId(null);
          dissolveHousehold.mutate(householdId);
        },
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
        onPress: () => {
          if (defaultHouseholdId === householdId) setDefaultHouseholdId(null);
          removeMember.mutate({ householdId, userId: user.id });
        },
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
          <Pressable
            testID="household-open-join-modal-btn"
            accessibilityRole="button"
            accessibilityLabel="Join with an invite code"
            onPress={() => setShowJoinModal(true)}
            style={{
              padding: theme.spacing.md,
              borderRadius: theme.radii.pill,
              borderWidth: 1,
              borderColor: theme.colors.border,
              alignItems: 'center',
              marginTop: theme.spacing.md,
              minHeight: 52,
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>
              Have an invite code? Join Household
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

          {/* Invite Card with 6-character code and 1-tap share sheet */}
          {householdId ? (
            <HouseholdInviteCard
              householdId={householdId}
              householdName={household?.name ?? activeHousehold?.name ?? 'Household'}
              inviteCode={household?.inviteCode ?? activeHousehold?.inviteCode}
              isOwner={myRole === 'owner'}
            />
          ) : null}

          {/* Default Household Mode Switch */}
          {householdId ? (
            <View
              testID="household-default-toggle-row"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: theme.colors.bgElevated,
                borderRadius: theme.radii.lg,
                borderWidth: 1,
                borderColor: theme.colors.border,
                padding: theme.spacing.md,
                marginTop: theme.spacing.md,
              }}
            >
              <View style={{ flex: 1, paddingRight: theme.spacing.sm }}>
                <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>
                  Default Household Pantry
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12, marginTop: 2 }}>
                  Save newly scanned and added groceries to this household by default.
                </Text>
              </View>
              <Switch
                testID="household-default-toggle-switch"
                accessibilityLabel="Set as default household"
                value={defaultHouseholdId === householdId}
                onValueChange={(val) => setDefaultHouseholdId(val ? householdId : null)}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
                thumbColor={theme.colors.bg}
              />
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
                  <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>+ Add Member by Email</Text>
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
      <JoinHouseholdModal
        visible={showJoinModal}
        initialCode={joinModalCode}
        onClose={() => setShowJoinModal(false)}
      />
    </View>
  );
}
