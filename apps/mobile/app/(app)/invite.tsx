import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { useReferralSummary } from '../../src/api/referrals';
import { ReferralCodeCard } from '../../src/features/referral/ReferralCodeCard';
import { InviteShareButton } from '../../src/features/referral/InviteShareButton';
import { useTheme } from '../../src/theme/useTheme';

export default function InviteScreen() {
  const t = useTheme();
  const q = useReferralSummary();

  if (q.isPending) return <ActivityIndicator />;
  if (q.isError || !q.data) {
    return <Text style={{ color: t.colors.text }}>Could not load your invite info.</Text>;
  }

  const s = q.data;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.colors.bg }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.lg }}
    >
      <Text
        style={{
          color: t.colors.text,
          fontSize: t.typeRamp.headlineMedium.fontSize,
          fontWeight: t.typeRamp.headlineMedium.fontWeight as any,
        }}
      >
        Invite friends
      </Text>

      <ReferralCodeCard code={s.referralCode} shareUrl={s.shareUrl} />
      <InviteShareButton code={s.referralCode} shareUrl={s.shareUrl} />

      <Text style={{ color: t.colors.textMuted }}>
        {s.activatedCount} friends activated
      </Text>
    </ScrollView>
  );
}
