import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '@/theme/useTheme';
import type { FeedbackType } from '@expyrico/shared';

interface TypeOption {
  type: FeedbackType;
  label: string;
  sublabel: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const OPTIONS: TypeOption[] = [
  {
    type: 'bug',
    label: 'Report Bug',
    sublabel: 'Something is broken',
    icon: 'bug-outline',
  },
  {
    type: 'suggestion',
    label: 'Suggestion',
    sublabel: 'Ideas & improvements',
    icon: 'bulb-outline',
  },
  {
    type: 'feedback',
    label: 'Feedback',
    sublabel: 'General thoughts',
    icon: 'chatbubble-ellipses-outline',
  },
];

export function FeedbackTypeSelector({
  value,
  onChange,
}: {
  value: FeedbackType;
  onChange: (type: FeedbackType) => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: theme.colors.textMuted }]}>SUBMISSION TYPE</Text>
      <View style={styles.row}>
        {OPTIONS.map((opt) => {
          const active = value === opt.type;
          return (
            <Pressable
              key={opt.type}
              testID={`feedback-type-${opt.type}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${opt.label}: ${opt.sublabel}`}
              onPress={() => onChange(opt.type)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? theme.colors.primaryLight : theme.colors.bgElevated,
                  borderColor: active ? theme.colors.primary : theme.colors.border,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={opt.icon}
                size={18}
                color={active ? theme.colors.primaryDark : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.chipLabel,
                  {
                    color: active ? theme.colors.primaryDark : theme.colors.text,
                    fontWeight: active ? '700' : '600',
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 64,
  },
  chipLabel: {
    fontSize: 11,
    textAlign: 'center',
  },
});
