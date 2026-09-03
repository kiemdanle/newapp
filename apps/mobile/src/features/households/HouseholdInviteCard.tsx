import React, { useState } from 'react';
import { View, Text, Pressable, Share, Alert } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../../theme/useTheme';
import { useRegenerateInviteCode } from '../../api/households';

interface Props {
  householdId: string;
  householdName: string;
  inviteCode?: string | null;
  isOwner: boolean;
}

export function HouseholdInviteCard({ householdId, householdName, inviteCode, isOwner }: Props) {
  const theme = useTheme();
  const [copied, setCopied] = useState(false);
  const regenerate = useRegenerateInviteCode();

  const code = inviteCode ?? '------';
  const shareUrl = `expyrico://household/join?code=${code}`;

  const handleShare = async () => {
    if (!inviteCode) return;
    try {
      await Share.share({
        title: `Join ${householdName} on Expyrico`,
        message: `Join my pantry "${householdName}" on Expyrico so we can track shared groceries and expiry together! Use invite code ${code} or tap: ${shareUrl}`,
        url: shareUrl,
      });
    } catch {
      // User dismissed share sheet
    }
  };

  const handleCopy = () => {
    if (!inviteCode) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRegenerate = () => {
    Alert.alert(
      'Regenerate Invite Code',
      'Anyone with the previous invite code or link will no longer be able to join. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => regenerate.mutate(householdId),
        },
      ],
    );
  };

  return (
    <View
      testID="household-invite-card"
      accessibilityLabel={`Household invite code ${code}`}
      style={{
        marginTop: theme.spacing.md,
        padding: theme.spacing.lg,
        borderRadius: theme.radii.lg,
        backgroundColor: theme.colors.bgElevated,
        borderWidth: 1,
        borderColor: theme.colors.border,
        gap: theme.spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.xs }}>
          <Ionicons name="people-outline" size={18} color={theme.colors.primary} />
          <Text
            style={{
              color: theme.colors.text,
              fontSize: theme.typeRamp.titleMedium.fontSize,
              fontWeight: '700',
            }}
          >
            Invite to Kitchen
          </Text>
        </View>
        {isOwner ? (
          <Pressable
            testID="household-regenerate-code-btn"
            accessibilityRole="button"
            accessibilityLabel="Regenerate invite code"
            onPress={handleRegenerate}
            disabled={regenerate.isPending}
            hitSlop={8}
            style={{ minHeight: 44, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {regenerate.isPending ? 'Regenerating…' : 'Regenerate'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={{ color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 }}>
        Share this code or link with your partner, family, or roommates so they can join your shared pantry.
      </Text>

      {/* Code Display Box */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.colors.bgGlass,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}
      >
        <View>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>
            Invite Code
          </Text>
          <Text
            testID="household-invite-code-text"
            style={{
              color: theme.colors.text,
              fontSize: 24,
              fontWeight: '800',
              fontFamily: theme.typography.fontFamilyDisplay,
              letterSpacing: 4,
              marginTop: 2,
            }}
          >
            {code}
          </Text>
        </View>

        <Pressable
          testID="household-copy-code-btn"
          accessibilityRole="button"
          accessibilityLabel="Copy invite code"
          onPress={handleCopy}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: copied ? theme.colors.primary : theme.colors.bgElevated,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            borderRadius: theme.radii.pill,
            borderWidth: 1,
            borderColor: copied ? theme.colors.primary : theme.colors.border,
            opacity: pressed ? 0.8 : 1,
            minHeight: 44,
            minWidth: 80,
            justifyContent: 'center',
          })}
        >
          <Ionicons
            name={copied ? 'checkmark' : 'copy-outline'}
            size={16}
            color={copied ? theme.colors.primaryFg : theme.colors.primary}
          />
          <Text
            style={{
              color: copied ? theme.colors.primaryFg : theme.colors.primary,
              fontWeight: '600',
              fontSize: 13,
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      {/* 1-Tap Share Button */}
      <Pressable
        testID="household-share-invite-btn"
        accessibilityRole="button"
        accessibilityLabel="Share invite link with family or roommates"
        onPress={handleShare}
        style={({ pressed }) => ({
          backgroundColor: theme.colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: theme.spacing.sm,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radii.pill,
          minHeight: 52,
          opacity: pressed ? 0.88 : 1,
        })}
      >
        <Ionicons name="share-social-outline" size={18} color={theme.colors.primaryFg} />
        <Text style={{ color: theme.colors.primaryFg, fontWeight: '700', fontSize: 15 }}>
          Invite Partner or Roommate
        </Text>
      </Pressable>
    </View>
  );
}
