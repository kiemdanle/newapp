import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  useHouseholdInvitationPreview,
  useAcceptHouseholdInvitation,
  useDeclineHouseholdInvitation,
} from '../../api/households';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  token: string;
  onClose: () => void;
  onAccepted?: (householdId: string) => void;
  onDeclined?: () => void;
}

export function HouseholdInvitationModal({
  visible,
  token,
  onClose,
  onAccepted,
  onDeclined,
}: Props) {
  const theme = useTheme();
  const { data: preview, isLoading, isError } = useHouseholdInvitationPreview(
    visible ? token : undefined,
  );
  const acceptMutation = useAcceptHouseholdInvitation();
  const declineMutation = useDeclineHouseholdInvitation();
  const [busy, setBusy] = useState(false);

  if (!visible) return null;

  const handleAccept = async () => {
    setBusy(true);
    try {
      const res = await acceptMutation.mutateAsync(token);
      Alert.alert(
        'Welcome!',
        `You have joined ${preview?.householdName ?? 'the household'}!`,
      );
      onClose();
      if (onAccepted) onAccepted(res.householdId);
    } catch (err: unknown) {
      let msg = 'Failed to accept invitation';
      if (err && typeof err === 'object' && 'title' in err) {
        msg = String((err as { title: unknown }).title);
      }
      Alert.alert('Accept Failed', msg);
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    setBusy(true);
    try {
      await declineMutation.mutateAsync(token);
      onClose();
      if (onDeclined) onDeclined();
    } catch (err: unknown) {
      let msg = 'Failed to decline invitation';
      if (err && typeof err === 'object' && 'title' in err) {
        msg = String((err as { title: unknown }).title);
      }
      Alert.alert('Decline Failed', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        testID="household-invitation-modal-backdrop"
        style={styles.backdrop}
        onPress={busy ? undefined : onClose}
      >
        <Pressable
          testID="household-invitation-modal-content"
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={[styles.loadingText, { color: theme.colors.textMuted }]}>
                Loading invitation details...
              </Text>
            </View>
          ) : isError || !preview ? (
            <View style={styles.errorBox}>
              <Ionicons
                name="alert-circle-outline"
                size={44}
                color={theme.colors.danger}
              />
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Invitation Unavailable
              </Text>
              <Text style={[styles.errorSubtitle, { color: theme.colors.textMuted }]}>
                This invitation may have expired, been revoked, or is invalid.
              </Text>
              <Pressable
                testID="invitation-close-btn"
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                style={[
                  styles.declineBtn,
                  { borderColor: theme.colors.border, marginTop: 16 },
                ]}
              >
                <Text
                  style={[styles.declineBtnText, { color: theme.colors.text }]}
                >
                  Close
                </Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {/* Header */}
              <View style={styles.header}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: theme.colors.primaryLight },
                  ]}
                >
                  <Ionicons
                    name="people"
                    size={28}
                    color={theme.colors.primaryDark}
                  />
                </View>
                <Text style={[styles.title, { color: theme.colors.text }]}>
                  Household Invitation
                </Text>
                <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                  {preview.inviterName} invited you to join
                </Text>
              </View>

              {/* Household Info Card */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.bg,
                    borderColor: theme.colors.border,
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <Text
                    style={[styles.householdName, { color: theme.colors.text }]}
                  >
                    {preview.householdName}
                  </Text>
                  <View
                    style={[
                      styles.memberBadge,
                      { backgroundColor: theme.colors.primaryLight },
                    ]}
                  >
                    <Text
                      style={[
                        styles.memberBadgeText,
                        { color: theme.colors.primaryDark },
                      ]}
                    >
                      {preview.memberCount}{' '}
                      {preview.memberCount === 1 ? 'member' : 'members'}
                    </Text>
                  </View>
                </View>

                <Text
                  style={[styles.explanation, { color: theme.colors.textMuted }]}
                >
                  You will be able to view, add, and track shared groceries
                  together in real time.
                </Text>
              </View>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <Pressable
                  testID="invitation-decline-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Decline invitation"
                  disabled={busy}
                  onPress={handleDecline}
                  style={[
                    styles.declineBtn,
                    { borderColor: theme.colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.declineBtnText,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    Decline
                  </Text>
                </Pressable>

                <Pressable
                  testID="invitation-accept-btn"
                  accessibilityRole="button"
                  accessibilityLabel="Accept invitation"
                  disabled={busy}
                  onPress={handleAccept}
                  style={[
                    styles.acceptBtn,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.acceptBtnText}>Accept & Join</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 24,
    paddingBottom: 40,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 24,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  householdName: {
    fontSize: 16,
    fontWeight: '700',
  },
  memberBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  memberBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  explanation: {
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  declineBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  acceptBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
