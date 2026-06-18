import { View, Text, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRecord, patchLocalRecord, deleteLocalRecord } from '../../../src/api/records';
import { useTheme } from '../../../src/theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from '../../../src/features/records/expiryStatus';

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
      <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '700' }}>
        {record.customName ?? 'Item'}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        <View
          testID={`record-expiry-status-${status}`}
          accessibilityLabel={`expiry status ${status}`}
          style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }}
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
        <Pressable
          testID="record-mark-consumed"
          onPress={() => mark('consumed')}
          style={{
            backgroundColor: theme.colors.success,
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.colors.textInverse, fontWeight: '700' }}>
            Mark as consumed
          </Text>
        </Pressable>
        <Pressable
          testID="record-mark-discarded"
          onPress={() => mark('discarded')}
          style={{
            backgroundColor: theme.colors.warning,
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.colors.textInverse, fontWeight: '700' }}>Discard</Text>
        </Pressable>
        <Pressable
          testID="record-delete"
          onPress={remove}
          style={{
            borderColor: theme.colors.danger,
            borderWidth: 1,
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: theme.colors.danger, fontWeight: '700' }}>Delete</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
