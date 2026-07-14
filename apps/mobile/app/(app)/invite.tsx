import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { useReferralSummary } from '../../src/api/referrals';
import { ReferralCodeCard } from '../../src/features/referral/ReferralCodeCard';
import { InviteShareButton } from '../../src/features/referral/InviteShareButton';
import { useTheme } from '../../src/theme/useTheme';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { EmptyState } from '../../src/components/EmptyState';

export default function InviteScreen() {
  const t = useTheme();
  const q = useReferralSummary();

  if (q.isPending) return <Screen><ActivityIndicator color={t.colors.primary} /></Screen>;
  if (q.isError || !q.data) {
    return <Screen><EmptyState icon="alert-circle-outline" title="Invite info is unavailable" body="Check your connection and try again." /></Screen>;
  }

  const s = q.data;
  return (
    <Screen>
      <Text
        style={{
          color: t.colors.text,
          fontSize: t.typeRamp.headlineMedium.fontSize,
          fontWeight: t.typeRamp.headlineMedium.fontWeight as any,
        }}
      >
        Give food a second chance
      </Text>
      <Text style={{ color: t.colors.textMuted, fontSize: t.typeRamp.bodyMedium.fontSize, lineHeight: 21 }}>
        Invite someone who will use what they buy. You both help waste less.
      </Text>
      <Card style={{ backgroundColor: t.colors.bgGlass }}>
        <ReferralCodeCard code={s.referralCode} shareUrl={s.shareUrl} />
        <InviteShareButton code={s.referralCode} shareUrl={s.shareUrl} />
      </Card>
      <View style={{ padding: 16, borderRadius: t.radii.lg, backgroundColor: t.colors.bgElevated, borderWidth: 1, borderColor: t.colors.border }}>
        <Text style={{ color: t.colors.primary, fontSize: 28, fontWeight: '800' }}>{s.activatedCount}</Text>
        <Text style={{ color: t.colors.textMuted }}>friends have joined with your code</Text>
      </View>
    </Screen>
  );
}
