import React from 'react';
import { Modal, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface SignOutLoadingModalProps {
  visible: boolean;
}

export function SignOutLoadingModal({ visible }: SignOutLoadingModalProps) {
  const theme = useTheme();
  if (!visible) return null;


  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <View style={styles.textWrap}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Signing Out
            </Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
              Securing your session…
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 280,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  textWrap: {
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
