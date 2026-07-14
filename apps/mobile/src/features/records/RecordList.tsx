import React, { useCallback, useMemo } from 'react';
import { SectionList, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useActiveRecords, type LocalRecord } from '../../api/records';
import { groupRecords } from './groupRecords';
import { RecordCard } from './RecordCard';
import { useTheme } from '../../theme/useTheme';

const SECTION_TITLES: Record<keyof ReturnType<typeof groupRecords>, string> = {
  expired: 'Expired',
  today: 'Expires today',
  thisWeek: 'Use this week',
  later: 'Later',
};

const RecordRow = React.memo(function RecordRow({ record, onPress }: { record: LocalRecord; onPress: (id: string) => void }) {
  return <RecordCard record={record} onPress={() => onPress(record.id)} />;
});

export function RecordList() {
  const records = useActiveRecords();
  const router = useRouter();
  const theme = useTheme();
  const groups = groupRecords(records);
  const sections = useMemo(
    () => (Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>)
      .filter((key) => groups[key].length > 0)
      .map((key) => ({ key, title: SECTION_TITLES[key], data: groups[key] })),
    [groups],
  );
  const openRecord = useCallback((id: string) => router.push(`/record/${id}`), [router]);
  const renderItem = useCallback(({ item }: { item: LocalRecord }) => <RecordRow record={item} onPress={openRecord} />, [openRecord]);
  const keyExtractor = useCallback((item: LocalRecord) => item.id, []);

  if (sections.length === 0) return null;

  return (
    <SectionList
      sections={sections}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      scrollEnabled={false}
      stickySectionHeadersEnabled={false}
      contentContainerStyle={{ gap: theme.spacing.md }}
      renderSectionHeader={({ section }) => (
        <View style={{ marginTop: theme.spacing.sm }}>
          <Text testID={`record-section-${section.key}`} style={{ color: theme.colors.textMuted, textTransform: 'uppercase', fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: theme.spacing.sm }}>
            {section.title} · {section.data.length}
          </Text>
        </View>
      )}
    />
  );
}
