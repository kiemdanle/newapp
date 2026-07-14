import { View, Text, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRecord, patchLocalRecord, deleteLocalRecord } from '../../../src/api/records';
import { useTheme } from '../../../src/theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../../../src/features/records/expiryStatus';
import { Button } from '../../../src/components/Button';

export default function RecordDetail() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const record = useRecord(id);

  if (!record) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <Text style={{ color: theme.colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  const mark = async (status: 'consumed' | 'discarded') => {
    await patchLocalRecord(record.id, { status });
    router.back();
  };

  const remove = async () => {
    await deleteLocalRecord(record.id);
    router.back();
  };

  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];

  return (
    <ScrollView
      contentContainerStyle={{
        padding: theme.spacing.lg,
        gap: theme.spacing.md,
        backgroundColor: theme.colors.bg,
      }}
    >
      <Text style={{ color: theme.colors.textMuted, fontSize: theme.typeRamp.labelMedium.fontSize, fontWeight: theme.typeRamp.labelMedium.fontWeight as any, letterSpacing: 1 }}>PANTRY ITEM</Text>
      <Text style={{ color: theme.colors.text, fontSize: theme.typeRamp.headlineMedium.fontSize, fontWeight: theme.typeRamp.headlineMedium.fontWeight as any }}>
        {record.customName ?? 'Item'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm, backgroundColor: theme.colors.bgGlass, borderRadius: theme.radii.md, padding: theme.spacing.md }}>
        <View
          testID={`record-expiry-status-${status}`}
          accessibilityLabel={`expiry status ${status}`}
          style={{ width: 10, height: 10, borderRadius: theme.radii.sm / 2, backgroundColor: statusColor }}
        />
        <Text style={{ color: statusColor }}>Expires {record.expiryDate}</Text>
      </View>
      <Text style={{ color: theme.colors.textMuted }}>
        {record.quantity} {record.unit}
      </Text>
      {record.notes ? (
        <Text style={{ color: theme.colors.text, marginTop: theme.spacing.md }}>
          {record.notes}
        </Text>
      ) : null}

      <View style={{ marginTop: theme.spacing.xl, gap: theme.spacing.md }}>
        <Button testID="record-mark-consumed" label="Mark as used" icon="checkmark" variant="secondary" onPress={() => void mark('consumed')} />
        <Button testID="record-mark-discarded" label="Discard item" icon="trash-outline" variant="outline" onPress={() => void mark('discarded')} />
        <Button testID="record-delete" label="Delete permanently" icon="close" variant="danger" onPress={() => void remove()} />
      </View>
    </ScrollView>
  );
}
