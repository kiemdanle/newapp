import React from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { ProductDraftRow } from '@expyrico/shared';
import { useTheme } from '../../theme/useTheme';
import { AddRecordForm } from '../records/AddRecordForm';
import { KeyboardAwareScrollView } from '../../components/KeyboardAwareScrollView';

export interface DraftPantryAddModalProps {
  visible: boolean;
  product: ProductDraftRow | null;
  onClose: () => void;
  onSaved: () => void;
}

export function DraftPantryAddModal({
  visible,
  product,
  onClose,
  onSaved,
}: DraftPantryAddModalProps) {
  const theme = useTheme();

  if (!product) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Full-screen backdrop tap-to-dismiss */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal"
          style={styles.dismissOverlay}
          onPress={onClose}
        />

        {/* Modal Card */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={[
            styles.modalCard,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          {/* Drag Handle Bar */}
          <View style={styles.handleBar}>
            <View style={styles.handlePill} />
          </View>

          {/* Header */}
          <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Add to Pantry</Text>
              <Text style={[styles.productName, { color: theme.colors.primaryDark }]} numberOfLines={1}>
                {product.name}
              </Text>
              {product.status === 'pending' ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons name="time-outline" size={12} color={theme.colors.accent} />
                  <Text style={{ fontSize: 11, color: theme.colors.accent, fontWeight: '600' }}>
                    Awaiting review · Personal pantry only
                  </Text>
                </View>
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              onPress={onClose}
              style={[
                styles.closeBtn,
                { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
              ]}
            >
              <Ionicons name="close" size={18} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Form Content */}
          <KeyboardAwareScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            extraKeyboardOffset={Platform.OS === 'android' ? 120 : 48}
          >
            <AddRecordForm
              key={product.id}
              productId={product.id}
              productName={product.name}
              lockedPersonalScope={product.status === 'pending'}
              onSaved={() => {
                onSaved();
                onClose();
              }}
            />
          </KeyboardAwareScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(44, 44, 40, 0.45)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    height: '84%',
    width: '100%',
    shadowColor: '#2C2C28',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  handleBar: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handlePill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D0D0CC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 60,
  },
});
