import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveRecords } from '../../api/records';
import { groupRecords } from './groupRecords';
import { RecordCard } from './RecordCard';
import { useTheme } from '../../theme/useTheme';
import { BentoTile } from '../../components/BentoTile';
import { ClayCard } from '../../components/ClayCard';
import { MD3ListRow } from '../../components/MD3ListRow';

const SECTION_TITLES: Record<keyof ReturnType<typeof groupRecords>, string> = {
  expired: 'Expired',
  today: 'Expires today',
  thisWeek: 'Expires this week',
  later: 'Later',
};

function ThemeRecordItem({
  record,
  onPress,
}: {
  record: ReturnType<typeof useActiveRecords>[number];
  onPress: () => void;
}) {
  const theme = useTheme();

  switch (theme.id) {
    case 'bento':
      return (
        <BentoTile
          size="md"
          title={record.customName ?? 'Item'}
          subtitle={`Expires ${record.expiryDate}`}
          onPress={onPress}
        />
      );
    case 'clay':
      return (
        <ClayCard>
          <RecordCard record={record} onPress={onPress} />
        </ClayCard>
      );
    case 'material':
      return (
        <MD3ListRow
          title={record.customName ?? 'Item'}
          subtitle={`Expires ${record.expiryDate} · ${record.quantity} ${record.unit}`}
          onPress={onPress}
        />
      );
    default:
      return <RecordCard record={record} onPress={onPress} />;
  }
}

export function RecordList() {
  const records = useActiveRecords();
  const router = useRouter();
  const theme = useTheme();
  const groups = groupRecords(records);
  const sections: Array<keyof typeof SECTION_TITLES> = ['expired', 'today', 'thisWeek', 'later'];
  const hasAny = sections.some((k) => groups[k].length > 0);

  if (!hasAny) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 48, gap: 8 }}>
        <Text style={{ fontSize: 16, fontWeight: '500', color: theme.colors.text }}>
          Your pantry is empty
        </Text>
        <Text style={{ fontSize: 14, color: theme.colors.textMuted, textAlign: 'center' }}>
          Tap the + button to scan your first item
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 18 }}>
      {sections.map((key) => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <View key={key}>
            <Text
              testID={`record-section-${key}`}
              style={{
                color: theme.colors.textMuted,
                textTransform: 'uppercase',
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 0.8,
                marginBottom: 10,
              }}
            >
              {SECTION_TITLES[key]} · {items.length}
            </Text>
            {theme.id === 'bento' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                {items.map((r) => (
                  <ThemeRecordItem
                    key={r.id}
                    record={r}
                    onPress={() => router.push(`/record/${r.id}`)}
                  />
                ))}
              </View>
            ) : (
              items.map((r) => (
                <ThemeRecordItem
                  key={r.id}
                  record={r}
                  onPress={() => router.push(`/record/${r.id}`)}
                />
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}
