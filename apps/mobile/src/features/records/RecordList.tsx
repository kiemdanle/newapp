import React, { useCallback, useMemo } from 'react';
import { SectionList, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../navigation/AppNavigator';
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

export function RecordList({ header, empty }: { header?: React.ReactElement; empty?: React.ReactElement }) {
  const records = useActiveRecords();
  const navigation = useNavigation<AppNavigationProp>();
  const theme = useTheme();
  const groups = groupRecords(records);
  const sections = useMemo(
    () => (Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>)
      .filter((key) => groups[key].length > 0)
      .map((key) => ({ key, title: SECTION_TITLES[key], data: groups[key] })),
    [groups],
  );
  const openRecord = useCallback((id: string) => navigation.navigate('Record', { id }), [navigation]);
  const renderItem = useCallback(({ item }: { item: LocalRecord }) => <RecordRow record={item} onPress={openRecord} />, [openRecord]);
  const keyExtractor = useCallback((item: LocalRecord) => item.id, []);

  return (
    <SectionList
      testID="pantry-record-list"
      sections={sections}
      scrollEnabled
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={{ gap: theme.spacing.md, padding: theme.spacing.xl, paddingBottom: 116, flexGrow: sections.length === 0 ? 1 : undefined }}
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
