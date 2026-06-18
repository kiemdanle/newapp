import { Pressable, Text, View } from 'react-native';
import type { LocalRecord } from '../../api/records';
import { useTheme } from '../../theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from './expiryStatus';

interface Props {
  record: LocalRecord;
  onPress: () => void;
}

export function RecordCard({ record, onPress }: Props) {
  const theme = useTheme();
  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  return (
    <Pressable accessibilityRole="button"
      onPress={onPress}
      testID={`record-card-${record.id}`}
      style={{
        padding: theme.spacing.lg,
        marginBottom: theme.spacing.sm,
        borderRadius: theme.radii.md,
        backgroundColor: theme.colors.bgElevated,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <View
            testID={`record-expiry-status-${status}`}
            accessibilityLabel={`expiry status ${status}`}
            style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }}
          />
          <Text style={{ color: theme.colors.text, fontWeight: '600', fontSize: 16 }}>
            {record.customName ?? 'Item'}
          </Text>
        </View>
        <Text style={{ color: theme.colors.textMuted }}>
          {record.quantity} {record.unit}
        </Text>
      </View>
      <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing.xs }}>
        Expires {record.expiryDate}
      </Text>
    </Pressable>
  );
}
