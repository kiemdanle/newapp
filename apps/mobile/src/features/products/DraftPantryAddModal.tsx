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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss modal"
          style={styles.dismissOverlay}
          onPress={onClose}
        />
        <View
          style={[
            styles.modalCard,
            { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, { color: theme.colors.text }]}>Add to Pantry</Text>
              <Text style={[styles.productName, { color: theme.colors.primaryDark }]} numberOfLines={1}>
                {product.name}
              </Text>
              {product.status === 'pending' ? (
                <Text style={{ fontSize: 11, color: theme.colors.accent, fontWeight: '600' }}>
                  Awaiting review · Added to your personal pantry
                </Text>
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
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  dismissOverlay: {
    flex: 1,
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    maxHeight: '88%',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
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
    paddingBottom: 40,
  },
});
