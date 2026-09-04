import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { LocalRecord } from '../../api/records';
import { bulkPatchLocalRecordScope } from '../../api/records';
import { useMyHouseholds } from '../../api/households';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
  selectedRecordIds: string[];
  records: LocalRecord[];
  onSuccess?: (updatedCount: number, destinationName: string) => void;
}

export function BulkScopeModal({
  visible,
  onClose,
  selectedRecordIds,
  records,
  onSuccess,
}: Props) {
  const theme = useTheme();
  const { data: householdsData } = useMyHouseholds();
  const [loading, setLoading] = useState(false);

  if (!visible) return null;

  // Selected records subset
  const selectedRecords = records.filter((r) => selectedRecordIds.includes(r.id));
  const count = selectedRecordIds.length;

  const firstRecord = selectedRecords[0];
  const allSameScope =
    Boolean(firstRecord) &&
    selectedRecords.every((r) => r.householdId === firstRecord!.householdId);
  const currentScopeId = allSameScope ? firstRecord!.householdId : undefined;

  const destinations: Array<{
    id: string | null;
    name: string;
    subtitle: string;
    icon: string;
  }> = [
    {
      id: null,
      name: 'Personal Pantry',
      subtitle: 'Private to you only',
      icon: 'person-outline',
    },
    ...(householdsData?.items ?? []).map((h) => ({
      id: h.id,
      name: h.name,
      subtitle: 'Shared with household members',
      icon: 'people-outline',
    })),
  ];

  const handleSelectDestination = async (
    targetId: string | null,
    targetName: string,
  ) => {
    setLoading(true);
    try {
      const res = await bulkPatchLocalRecordScope(selectedRecordIds, targetId);
      onClose();
      if (onSuccess) {
        onSuccess(res.updatedCount, targetName);
      }
    } catch (err: unknown) {
      let title = 'Failed to move items';
      let isOffline = false;
      if (err && typeof err === 'object') {
        const e = err as { title?: string; message?: string; status?: number };
        if (e.title) title = e.title;
        else if (e.message) title = e.message;
        if (
          title.toLowerCase().includes('network') ||
          title.toLowerCase().includes('offline') ||
          e.status === 0
        ) {
          isOffline = true;
        }
      }
      if (isOffline) {
        Alert.alert(
          'Network Required',
          'Internet connection required to move pantry items.',
        );
      } else {
        Alert.alert('Move Failed', title);
      }
    } finally {
      setLoading(false);
    }
  };
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        testID="bulk-scope-modal-backdrop"
        style={styles.backdrop}
        onPress={loading ? undefined : onClose}
      >
        <Pressable
          testID="bulk-scope-modal-content"
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Move {count} {count === 1 ? 'item' : 'items'}
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                Choose destination pantry
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              disabled={loading}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Destinations */}
          <View style={styles.destList}>
            {destinations.map((dest) => {
              const isCurrent = currentScopeId !== undefined && currentScopeId === dest.id;
              return (
                <Pressable
                  key={dest.id ?? 'personal'}
                  testID={`bulk-scope-dest-${dest.id ?? 'personal'}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Move to ${dest.name}`}
                  disabled={loading}
                  onPress={() => handleSelectDestination(dest.id, dest.name)}
                  style={({ pressed }) => [
                    styles.destRow,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: pressed
                        ? theme.colors.bgGlass
                        : theme.colors.bg,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.iconWrap,
                      {
                        backgroundColor: dest.id === null
                          ? theme.colors.bgGlass
                          : theme.colors.primaryLight,
                      },
                    ]}
                  >
                    <Ionicons
                      name={dest.icon}
                      size={20}
                      color={
                        dest.id === null
                          ? theme.colors.neutralDark
                          : theme.colors.primaryDark
                      }
                    />
                  </View>
                  <View style={styles.destMeta}>
                    <View style={styles.destTitleRow}>
                      <Text style={[styles.destName, { color: theme.colors.text }]}>
                        {dest.name}
                      </Text>
                      {isCurrent ? (
                        <View
                          style={[
                            styles.currentBadge,
                            { backgroundColor: theme.colors.primaryLight },
                          ]}
                        >
                          <Text
                            style={[
                              styles.currentBadgeText,
                              { color: theme.colors.primaryDark },
                            ]}
                          >
                            Current
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text
                      style={[styles.destSubtitle, { color: theme.colors.textMuted }]}
                    >
                      {dest.subtitle}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={theme.colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  destList: {
    gap: 10,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  destMeta: {
    flex: 1,
  },
  destTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  destName: {
    fontSize: 15,
    fontWeight: '600',
  },
  currentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  destSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
