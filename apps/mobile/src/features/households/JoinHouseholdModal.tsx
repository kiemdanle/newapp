import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';
import { useJoinHousehold, useHouseholdInvitePreview } from '../../api/households';
import type { Household } from '@expyrico/shared';

interface Props {
  visible: boolean;
  initialCode?: string | null;
  onClose: () => void;
  onJoined?: (household: Household) => void;
}

export function JoinHouseholdModal({ visible, initialCode, onClose, onJoined }: Props) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const joinMutation = useJoinHousehold();
  const normalizedCode = code.trim().toUpperCase();
  const { data: preview, isLoading: isPreviewLoading } = useHouseholdInvitePreview(
    normalizedCode.length >= 4 ? normalizedCode : undefined,
  );

  useEffect(() => {
    if (initialCode) {
      setCode(initialCode.trim().toUpperCase());
      setError(null);
    } else {
      setCode('');
      setError(null);
    }
  }, [initialCode, visible]);

  const handleJoin = async () => {
    if (normalizedCode.length < 4) {
      setError('Please enter a valid 6-character invite code');
      return;
    }
    setError(null);
    try {
      const joined = await joinMutation.mutateAsync({ code: normalizedCode });
      onJoined?.(joined);
      onClose();
    } catch (e: any) {
      const msg = e?.message ?? '';
      if (msg.includes('404') || e?.code === 'household_not_found') {
        setError('Invalid or expired invite code. Please check with your household owner.');
      } else if (msg.includes('409') || e?.code === 'conflict') {
        setError('You are already a member of this household.');
      } else {
        setError(msg || 'Failed to join household. Please try again.');
      }
    }
  };

  const isDark = theme.scheme === 'dark';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.45)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: theme.spacing.lg,
        }}
      >
        <View
          testID="join-household-modal"
          style={{
            width: '100%',
            maxWidth: 400,
            borderRadius: theme.radii.xl,
            backgroundColor: theme.colors.bgElevated,
            padding: theme.spacing.xl,
            borderWidth: 1,
            borderColor: theme.colors.border,
            gap: theme.spacing.md,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
              <Ionicons name="home-outline" size={20} color={theme.colors.primary} />
              <Text
                style={{
                  color: theme.colors.text,
                  fontSize: theme.typeRamp.titleLarge.fontSize,
                  fontWeight: '700',
                }}
              >
                Join a Household
              </Text>
            </View>
            <Pressable
              testID="join-household-close-btn"
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
            Enter the 6-character invite code sent by your household owner or partner to share groceries and track expiry together.
          </Text>

          {/* Code Input */}
          <TextInput
            testID="join-household-code-input"
            accessibilityLabel="Household invite code"
            value={code}
            onChangeText={(val) => {
              setCode(val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
              setError(null);
            }}
            placeholder="e.g. KITCH8"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={8}
            style={{
              height: 56,
              borderRadius: theme.radii.md,
              borderWidth: 1.5,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              backgroundColor: theme.colors.bgGlass,
              color: theme.colors.text,
              fontSize: 22,
              fontWeight: '800',
              fontFamily: theme.typography.fontFamilyDisplay,
              textAlign: 'center',
              letterSpacing: 4,
            }}
          />

          {/* Error Banner */}
          {error ? (
            <View
              testID="join-household-error"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                backgroundColor: isDark ? 'rgba(224, 68, 42, 0.15)' : '#FDE8E4',
                padding: theme.spacing.sm,
                borderRadius: theme.radii.md,
              }}
            >
              <Ionicons name="alert-circle-outline" size={16} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontSize: 12, flex: 1, fontWeight: '500' }}>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Household Confirmation Card (when preview resolves) */}
          {preview ? (
            <View
              testID="join-household-preview-card"
              style={{
                padding: theme.spacing.md,
                backgroundColor: isDark ? 'rgba(75, 174, 138, 0.15)' : '#D6F0E6',
                borderRadius: theme.radii.md,
                borderWidth: 1,
                borderColor: theme.colors.primary,
                gap: 4,
              }}
            >
              <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 15 }}>
                {preview.name}
              </Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                Owner: {preview.ownerName} · {preview.memberCount} existing member{preview.memberCount === 1 ? '' : 's'}
              </Text>
            </View>
          ) : isPreviewLoading && normalizedCode.length >= 4 ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : null}

          {/* Actions */}
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
            <Pressable
              testID="join-household-submit-btn"
              accessibilityRole="button"
              accessibilityLabel="Join household"
              onPress={handleJoin}
              disabled={joinMutation.isPending || normalizedCode.length < 4}
              style={({ pressed }) => ({
                backgroundColor: normalizedCode.length < 4 ? theme.colors.textMuted : theme.colors.primary,
                paddingVertical: theme.spacing.md,
                borderRadius: theme.radii.pill,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 48,
                opacity: pressed ? 0.88 : 1,
              })}
            >
              {joinMutation.isPending ? (
                <ActivityIndicator color={theme.colors.primaryFg} />
              ) : (
                <Text style={{ color: theme.colors.primaryFg, fontWeight: '700', fontSize: 15 }}>
                  Join Household
                </Text>
              )}
            </Pressable>

            <Pressable
              testID="join-household-cancel-btn"
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={onClose}
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 44,
              }}
            >
              <Text style={{ color: theme.colors.textMuted, fontSize: 14 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
