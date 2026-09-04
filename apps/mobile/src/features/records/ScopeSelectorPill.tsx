import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useMyHouseholds } from '../../api/households';
import { useTheme } from '../../theme/useTheme';

export interface ScopeSelectorPillProps {
  selectedScope: 'personal' | 'household';
  selectedHouseholdId: string | null;
  onChange: (scope: 'personal' | 'household', householdId: string | null) => void;
  testID?: string;
}

export function ScopeSelectorPill({
  selectedScope,
  selectedHouseholdId,
  onChange,
  testID = 'scope-selector-pill',
}: ScopeSelectorPillProps) {
  const theme = useTheme();
  const { data: householdsData } = useMyHouseholds();
  const households = householdsData?.items ?? [];
  const [pickerVisible, setPickerVisible] = useState(false);

  // If user belongs to 0 households, cleanly hide the selector
  if (households.length === 0) {
    return null;
  }

  // Active household name
  const currentHousehold = households.find((h) => h.id === selectedHouseholdId) ?? households[0];
  const activeHouseholdName = currentHousehold?.name ?? 'Household';

  const handlePersonalPress = () => {
    onChange('personal', null);
  };

  const handleHouseholdPress = () => {
    if (households.length > 1) {
      setPickerVisible(true);
    } else {
      onChange('household', households[0]?.id ?? null);
    }
  };

  const isPersonalActive = selectedScope === 'personal';
  const isHouseholdActive = selectedScope === 'household';

  return (
    <View testID={testID} style={styles.outerContainer}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>
        Save to pantry:
      </Text>

      <View
        style={[
          styles.pillContainer,
          {
            backgroundColor: theme.colors.bgElevated,
            borderColor: theme.colors.border,
          },
        ]}
      >
        {/* Personal Segment */}
        <Pressable
          testID={`${testID}-personal`}
          accessibilityRole="button"
          accessibilityLabel="Personal pantry"
          onPress={handlePersonalPress}
          style={[
            styles.segment,
            isPersonalActive && {
              backgroundColor: theme.colors.primary,
            },
          ]}
        >
          <Ionicons
            name="person-outline"
            size={14}
            color={isPersonalActive ? '#FFFFFF' : theme.colors.textMuted}
          />
          <Text
            style={[
              styles.segmentText,
              { color: isPersonalActive ? '#FFFFFF' : theme.colors.textMuted },
            ]}
          >
            Personal
          </Text>
        </Pressable>

        {/* Household Segment */}
        <Pressable
          testID={`${testID}-household`}
          accessibilityRole="button"
          accessibilityLabel={`Household ${activeHouseholdName}`}
          onPress={handleHouseholdPress}
          style={[
            styles.segment,
            isHouseholdActive && {
              backgroundColor: theme.colors.primary,
            },
          ]}
        >
          <Ionicons
            name="people-outline"
            size={14}
            color={isHouseholdActive ? '#FFFFFF' : theme.colors.textMuted}
          />
          <Text
            numberOfLines={1}
            style={[
              styles.segmentText,
              { color: isHouseholdActive ? '#FFFFFF' : theme.colors.textMuted },
            ]}
          >
            {activeHouseholdName}
          </Text>
          {households.length > 1 && (
            <Ionicons
              name="chevron-down"
              size={12}
              color={isHouseholdActive ? '#FFFFFF' : theme.colors.textMuted}
            />
          )}
        </Pressable>
      </View>

      {/* Household Selection Sheet when user has >1 household */}
      {households.length > 1 && (
        <Modal
          visible={pickerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPickerVisible(false)}
        >
          <Pressable
            testID={`${testID}-modal-backdrop`}
            style={styles.modalBackdrop}
            onPress={() => setPickerVisible(false)}
          >
            <View
              style={[
                styles.modalSheet,
                {
                  backgroundColor: theme.colors.bgElevated,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                Select Shared Household
              </Text>
              <View style={styles.modalList}>
                {households.map((h) => {
                  const isSelected = isHouseholdActive && selectedHouseholdId === h.id;
                  return (
                    <Pressable
                      key={h.id}
                      testID={`${testID}-option-${h.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${h.name}`}
                      onPress={() => {
                        onChange('household', h.id);
                        setPickerVisible(false);
                      }}
                      style={[
                        styles.modalOption,
                        {
                          borderColor: theme.colors.border,
                          backgroundColor: isSelected
                            ? theme.colors.primaryLight
                            : theme.colors.bg,
                        },
                      ]}
                    >
                      <View style={styles.modalOptionLeft}>
                        <Ionicons
                          name="people-outline"
                          size={18}
                          color={
                            isSelected
                              ? theme.colors.primaryDark
                              : theme.colors.textMuted
                          }
                        />
                        <Text
                          style={[
                            styles.modalOptionText,
                            {
                              color: isSelected
                                ? theme.colors.primaryDark
                                : theme.colors.text,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {h.name}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="checkmark"
                          size={18}
                          color={theme.colors.primaryDark}
                        />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    marginVertical: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  pillContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    padding: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalList: {
    gap: 8,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modalOptionText: {
    fontSize: 15,
  },
});
