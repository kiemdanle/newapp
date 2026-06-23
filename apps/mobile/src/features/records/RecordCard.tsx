import { Pressable, Text, View } from 'react-native';
import type { LocalRecord } from '../../api/records';
import { useTheme } from '../../theme/useTheme';
import { expiryStatus, EXPIRY_STATUS_TOKEN } from './expiryStatus';

interface Props {
  record: LocalRecord;
  onPress: () => void;
  addedByName?: string | null;
}

export function RecordCard({ record, onPress, addedByName }: Props) {
  const theme = useTheme();
  const status = expiryStatus(record.expiryDate);
  const statusColor = theme.colors[EXPIRY_STATUS_TOKEN[status]];
  const statusBg = status === 'amber'
    ? '#FEEFC3'
    : status === 'red'
      ? 'rgba(224,68,42,0.10)'
      : 'rgba(75,174,138,0.12)';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      testID={`record-card-${record.id}`}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          marginBottom: theme.spacing.sm,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.bgElevated,
          overflow: 'hidden',
          opacity: pressed ? 0.88 : 1,
          shadowColor: '#2C2C28',
          shadowOpacity: 0.05,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        },
      ]}
    >
      {/* Status edge bar */}
      <View testID={`record-expiry-status-${status}`} style={{ width: 4, backgroundColor: statusColor }} />

      <View style={{ flex: 1, padding: theme.spacing.md + 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Text
            style={{ color: theme.colors.text, fontWeight: '600', fontSize: 16, flex: 1, flexShrink: 1 }}
            numberOfLines={1}
          >
            {record.customName ?? 'Item'}
          </Text>
          <View style={{ backgroundColor: statusBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginLeft: 8 }}>
            <Text style={{ color: statusColor, fontSize: 11, fontWeight: '600' }}>
              {record.quantity} {record.unit}
            </Text>
          </View>
        </View>
        <Text style={{ color: theme.colors.textMuted, fontSize: 13, marginTop: 4 }}>
          Expires {record.expiryDate}
        </Text>
        {addedByName ? (
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, marginTop: 3 }}>
            added by {addedByName}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
