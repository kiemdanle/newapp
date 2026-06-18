import { ScrollView, Text, View } from 'react-native';
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

/**
 * Map each record to a theme-appropriate component.
 * - bento: 2-col BentoTile grid
 * - clay: ClayCard wrap around RecordCard
 * - material: MD3ListRow
 * - expyrico (default): existing RecordCard
 */
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

  return (
    <ScrollView contentContainerStyle={{ padding: theme.spacing.lg }}>
      {sections.map((key) => {
        const items = groups[key];
        if (items.length === 0) return null;
        return (
          <View key={key} style={{ marginBottom: theme.spacing.lg }}>
            <Text
              testID={`record-section-${key}`}
              style={{
                color: theme.colors.textMuted,
                textTransform: 'uppercase',
                fontSize: 12,
                marginBottom: theme.spacing.sm,
              }}
            >
              {SECTION_TITLES[key]}
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
    </ScrollView>
  );
}
