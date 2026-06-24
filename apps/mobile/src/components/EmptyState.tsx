import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';
import { useTheme } from '../theme/useTheme';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
};

export function EmptyState({ icon, title, body, actionLabel, actionIcon, onAction }: Props) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.bgGlass,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.xl,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: theme.colors.bgElevated,
            borderRadius: theme.radii.lg,
          },
        ]}
      >
        <Ionicons name={icon} size={30} color={theme.colors.primary} />
      </View>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      <Text style={[styles.body, { color: theme.colors.textMuted }]}>{body}</Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} icon={actionIcon} onPress={onAction} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    borderWidth: 1,
    gap: 12,
    minHeight: 44,
    padding: 24,
  },
  iconWrap: {
    alignItems: 'center',
    height: 60,
    justifyContent: 'center',
    width: 60,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 270,
    textAlign: 'center',
  },
});
