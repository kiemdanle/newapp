import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveRecords } from '../../api/records';
import { groupRecords } from './groupRecords';
import { RecordCard } from './RecordCard';
import { useTheme } from '../../theme/useTheme';

const SECTION_TITLES: Record<keyof ReturnType<typeof groupRecords>, string> = {
  expired: 'Expired',
  today: 'Expires today',
  thisWeek: 'Expires this week',
  later: 'Later',
};

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
            {items.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                onPress={() => router.push(`/record/${r.id}`)}
              />
            ))}
          </View>
        );
      })}
    </ScrollView>
  );
}
