import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useMyHouseholds } from '../../api/households';
import { usePantryScope } from '../../store/pantryScope';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function DefaultPantryModal({ visible, onClose }: Props) {
  const theme = useTheme();
  const { defaultPantryTarget, setDefaultPantryTarget } = usePantryScope();
  const { data: householdsData } = useMyHouseholds();
  const households = householdsData?.items ?? [];

  if (!visible) return null;

  const handleSelect = (scope: 'personal' | 'household', householdId: string | null) => {
    void setDefaultPantryTarget({ scope, householdId });
    onClose();
  };

  const isPersonalSelected = defaultPantryTarget.scope === 'personal';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        testID="default-pantry-modal-backdrop"
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable
          testID="default-pantry-modal-content"
          style={[
            styles.sheet,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>
                Default Pantry for New Items
              </Text>
              <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
                New items scanned or created manually will automatically be assigned to this pantry.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onClose}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <View style={styles.optionList}>
            {/* Personal Option */}
            <Pressable
              testID="default-pantry-option-personal"
              accessibilityRole="button"
              accessibilityLabel="Personal Pantry (Private)"
              onPress={() => handleSelect('personal', null)}
              style={[
                styles.optionRow,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: isPersonalSelected
                    ? theme.colors.primaryLight
                    : theme.colors.bg,
                },
              ]}
            >
              <View style={styles.optionLeft}>
                <View
                  style={[
                    styles.iconWrap,
                    {
                      backgroundColor: isPersonalSelected
                        ? theme.colors.bgElevated
                        : theme.colors.bgGlass,
                    },
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={
                      isPersonalSelected
                        ? theme.colors.primaryDark
                        : theme.colors.textMuted
                    }
                  />
                </View>
                <View>
                  <Text
                    style={[
                      styles.optionTitle,
                      {
                        color: isPersonalSelected
                          ? theme.colors.primaryDark
                          : theme.colors.text,
                        fontWeight: isPersonalSelected ? '700' : '600',
                      },
                    ]}
                  >
                    Personal Pantry
                  </Text>
                  <Text style={[styles.optionSub, { color: theme.colors.textMuted }]}>
                    Private to you only
                  </Text>
                </View>
              </View>
              {isPersonalSelected && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={theme.colors.primary}
                />
              )}
            </Pressable>

            {/* Household Options */}
            {households.map((h) => {
              const isHhSelected =
                defaultPantryTarget.scope === 'household' &&
                defaultPantryTarget.householdId === h.id;
              return (
                <Pressable
                  key={h.id}
                  testID={`default-pantry-option-${h.id}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Household ${h.name}`}
                  onPress={() => handleSelect('household', h.id)}
                  style={[
                    styles.optionRow,
                    {
                      borderColor: theme.colors.border,
                      backgroundColor: isHhSelected
                        ? theme.colors.primaryLight
                        : theme.colors.bg,
                    },
                  ]}
                >
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.iconWrap,
                        {
                          backgroundColor: isHhSelected
                            ? theme.colors.bgElevated
                            : theme.colors.bgGlass,
                        },
                      ]}
                    >
                      <Ionicons
                        name="people-outline"
                        size={20}
                        color={
                          isHhSelected
                            ? theme.colors.primaryDark
                            : theme.colors.textMuted
                        }
                      />
                    </View>
                    <View>
                      <Text
                        style={[
                          styles.optionTitle,
                          {
                            color: isHhSelected
                              ? theme.colors.primaryDark
                              : theme.colors.text,
                            fontWeight: isHhSelected ? '700' : '600',
                          },
                        ]}
                      >
                        {h.name}
                      </Text>
                      <Text
                        style={[styles.optionSub, { color: theme.colors.textMuted }]}
                      >
                        Shared with household members
                      </Text>
                    </View>
                  </View>
                  {isHhSelected && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={theme.colors.primary}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
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
    marginTop: 4,
    lineHeight: 18,
  },
  optionList: {
    gap: 10,
    marginTop: 6,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 15,
  },
  optionSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
