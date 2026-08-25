import React, { useCallback, useMemo, useState } from 'react';
import { Alert, SectionList, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { AppNavigationProp } from '../../navigation/AppNavigator';
import { useActiveRecords, patchLocalRecord, deleteLocalRecord, type LocalRecord } from '../../api/records';
import { groupRecords, type GroupedRecords } from './groupRecords';
import { RecordCard } from './RecordCard';
import { QuickEditModal } from './QuickEditModal';
import { useTheme } from '../../theme/useTheme';

const SECTION_TITLES: Record<keyof GroupedRecords, string> = {
  expired: 'Expired',
  today: 'Expires today',
  thisWeek: 'Use this week',
  later: 'Later',
};

interface RowProps {
  record: LocalRecord;
  onPress: (id: string) => void;
  onAddQuantity: (record: LocalRecord) => void;
  onEdit: (record: LocalRecord) => void;
  onDelete: (record: LocalRecord) => void;
}

const RecordRow = React.memo(function RecordRow({ record, onPress, onAddQuantity, onEdit, onDelete }: RowProps) {
  return (
    <RecordCard
      record={record}
      onPress={() => onPress(record.id)}
      onAddQuantity={onAddQuantity}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
});

export function RecordList({ header, empty }: { header?: React.ReactElement; empty?: React.ReactElement }) {
  const records = useActiveRecords();
  const navigation = useNavigation<AppNavigationProp>();
  const theme = useTheme();
  const [editingRecord, setEditingRecord] = useState<LocalRecord | null>(null);

  const groups = useMemo(() => groupRecords(records), [records]);
  const sections = useMemo(
    () => (Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>)
      .filter((key) => groups[key].length > 0)
      .map((key) => ({ key, title: SECTION_TITLES[key], data: groups[key] })),
    [groups],
  );

  const openRecord = useCallback((id: string) => navigation.navigate('Record', { id }), [navigation]);

  const handleAddQuantity = useCallback(async (record: LocalRecord) => {
    await patchLocalRecord(record.id, { quantity: record.quantity + 1 });
  }, []);

  const handleEdit = useCallback((record: LocalRecord) => {
    setEditingRecord(record);
  }, []);

  const handleDelete = useCallback((record: LocalRecord) => {
    const itemName = record.customName || 'this item';
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${itemName}"? It will be removed from your pantry.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void deleteLocalRecord(record.id);
          },
        },
      ],
    );
  }, []);

  const handleSaveEdit = useCallback(async (patch: {
    customName?: string | null;
    quantity: number;
    unit: string;
    expiryDate: string;
  }) => {
    if (!editingRecord) return;
    await patchLocalRecord(editingRecord.id, patch);
  }, [editingRecord]);

  const renderItem = useCallback(
    ({ item }: { item: LocalRecord }) => (
      <RecordRow
        record={item}
        onPress={openRecord}
        onAddQuantity={handleAddQuantity}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    ),
    [openRecord, handleAddQuantity, handleEdit, handleDelete],
  );

  const keyExtractor = useCallback((item: LocalRecord) => item.id, []);

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        testID="pantry-record-list"
        sections={sections}
        scrollEnabled
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={{
          gap: theme.spacing.md,
          padding: theme.spacing.xl,
          paddingBottom: 116,
          flexGrow: sections.length === 0 ? 1 : undefined,
        }}
        renderSectionHeader={({ section }) => (
          <View style={{ marginTop: theme.spacing.sm }}>
            <Text
              testID={`record-section-${section.key}`}
              style={{
                color: theme.colors.textMuted,
                textTransform: 'uppercase',
                fontSize: 11,
                fontWeight: '700',
                letterSpacing: 0.8,
                marginBottom: theme.spacing.sm,
              }}
            >
              {section.title} · {section.data.length}
            </Text>
          </View>
        )}
      />

      <QuickEditModal
        visible={Boolean(editingRecord)}
        record={editingRecord}
        onClose={() => setEditingRecord(null)}
        onSave={handleSaveEdit}
      />
    </View>
  );
}
