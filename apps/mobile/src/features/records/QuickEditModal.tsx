import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import type { LocalRecord } from '../../api/records';
import { useTheme } from '../../theme/useTheme';
import { Button } from '../../components/Button';
import { TextField } from '../../components/TextField';
import { WheelDatePickerModal } from '../../components/WheelDatePickerModal';
import { UnitSelector } from '../../components/UnitSelector';

interface Props {
  visible: boolean;
  record: LocalRecord | null;
  productName?: string | null;
  onClose: () => void;
  onSave: (patch: { customName?: string | null; quantity: number; unit: string; expiryDate: string }) => Promise<void>;
}


export function QuickEditModal({ visible, record, productName, onClose, onSave }: Props) {
  const theme = useTheme();
  const [customName, setCustomName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unit, setUnit] = useState('pcs');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  useEffect(() => {
    if (record) {
      setCustomName(record.customName ?? productName ?? '');
      setQuantity(String(record.quantity ?? 1));
      setUnit(record.unit || 'pcs');
      setExpiryDate(record.expiryDate || '');
    }
  }, [record, productName]);

  if (!record) return null;

  const increment = () => {
    const parsed = parseFloat(quantity) || 0;
    setQuantity(String(Math.max(1, parsed + 1)));
  };

  const decrement = () => {
    const parsed = parseFloat(quantity) || 1;
    if (parsed > 1) {
      setQuantity(String(parsed - 1));
    }
  };

  const handleSave = async () => {
    const parsedQty = parseFloat(quantity);
    const validQty = Number.isFinite(parsedQty) && parsedQty > 0 ? parsedQty : record.quantity;
    setSaving(true);
    try {
      await onSave({
        customName: customName.trim() || null,
        quantity: validQty,
        unit: unit.trim() || 'pcs',
        expiryDate: expiryDate.trim() || record.expiryDate,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: theme.colors.bgElevated, borderColor: theme.colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>Quick Edit</Text>
            <Pressable
              hitSlop={8}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close edit modal"
            >
              <Ionicons name="close" size={24} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          {/* Item Name */}
          <TextField
            label="Item Name"
            value={customName}
            onChangeText={setCustomName}
            placeholder={productName || 'Item name'}
            autoCapitalize="sentences"
          />

          {/* Quantity Stepper */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>Quantity</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                testID="qty-decrement"
                accessibilityRole="button"
                accessibilityLabel="Decrease quantity"
                onPress={decrement}
                style={[styles.stepperBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.bgGlass }]}
              >
                <Ionicons name="remove" size={20} color={theme.colors.text} />
              </Pressable>
              <TextInput
                testID="qty-input"
                accessibilityLabel="Quantity input"
                keyboardType="decimal-pad"
                value={quantity}
                onChangeText={setQuantity}
                style={[
                  styles.qtyInput,
                  { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.bgGlass },
                ]}
              />
              <Pressable
                testID="qty-increment"
                accessibilityRole="button"
                accessibilityLabel="Increase quantity"
                onPress={increment}
                style={[styles.stepperBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.bgGlass }]}
              >
                <Ionicons name="add" size={20} color={theme.colors.text} />
              </Pressable>
            </View>
          </View>

          {/* Unit Selector */}
          <UnitSelector
            value={unit}
            onChange={setUnit}
            label="Unit"
            testID="quick-edit-unit-selector"
          />

          {/* Expiry Date */}
          <View style={{ gap: 6 }}>
            <Text style={[styles.label, { color: theme.colors.textMuted }]}>Expiry Date</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Select expiry date"
              onPress={() => setShowDatePicker(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderWidth: 1,
                borderRadius: theme.radii.md,
                paddingHorizontal: 16,
                paddingVertical: 13,
                borderColor: theme.colors.border,
                backgroundColor: theme.colors.bgGlass,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Ionicons name="calendar-outline" size={20} color={theme.colors.primary} />
                <Text
                  style={{
                    color: expiryDate ? theme.colors.text : theme.colors.textMuted,
                    fontSize: 15,
                    fontWeight: expiryDate ? '600' : '400',
                  }}
                >
                  {expiryDate || 'Select expiry date'}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} />
              <TextInput
                accessibilityLabel="Text input field"
                style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
                value={expiryDate}
                onChangeText={setExpiryDate}
              />
            </Pressable>
          </View>

          <WheelDatePickerModal
            visible={showDatePicker}
            value={expiryDate}
            onClose={() => setShowDatePicker(false)}
            onConfirm={(iso) => setExpiryDate(iso)}
          />
          {/* Action Buttons */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Button label="Cancel" variant="ghost" onPress={onClose} />
            </View>
            <View style={{ flex: 1 }}>
              <Button testID="save-quick-edit" label="Save" loading={saving} onPress={handleSave} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});
