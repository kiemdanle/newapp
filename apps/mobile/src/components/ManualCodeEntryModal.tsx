import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/useTheme';
import { Button } from './Button';

export interface ManualCodeEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (code: string, kind: 'barcode' | 'qr') => Promise<void> | void;
}

const BARCODE_REGEX = /^[0-9]{8,14}$/;

export function ManualCodeEntryModal({
  visible,
  onClose,
  onSubmit,
}: ManualCodeEntryModalProps) {
  const theme = useTheme();
  const [kind, setKind] = useState<'barcode' | 'qr'>('barcode');
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const cleanCode = code.trim();
  const isValidBarcode = kind === 'barcode' ? BARCODE_REGEX.test(cleanCode) : cleanCode.length > 0;

  const handleSubmit = async () => {
    if (!cleanCode) {
      setErrorMessage('Please enter a product code');
      return;
    }

    if (kind === 'barcode' && !BARCODE_REGEX.test(cleanCode)) {
      setErrorMessage('Barcodes must contain 8 to 14 numeric digits (e.g. EAN-13 or UPC-A)');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await onSubmit(cleanCode, kind);
      setCode('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to start draft';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCode('');
    setErrorMessage(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[
            styles.modalCard,
            {
              backgroundColor: theme.colors.bgElevated,
              borderColor: theme.colors.border,
            },
          ]}
          onPress={(e) => e?.stopPropagation?.()}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: theme.colors.text,
                }}
              >
                Add Product Manually
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: theme.colors.textMuted,
                  marginTop: 2,
                }}
              >
                Type a barcode or QR code to start a new catalog draft
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close modal"
              onPress={handleClose}
              style={[styles.closeButton, { backgroundColor: theme.colors.bgGlass }]}
            >
              <Ionicons name="close" size={20} color={theme.colors.text} />
            </Pressable>
          </View>

          {/* Kind Toggle (Barcode vs QR) */}
          <View
            style={[
              styles.segmentContainer,
              { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
            ]}
          >
            <Pressable
              testID="toggle-barcode-btn"
              accessibilityRole="button"
              accessibilityLabel="Barcode mode"
              onPress={() => {
                setKind('barcode');
                setErrorMessage(null);
              }}
              style={[
                styles.segmentTab,
                kind === 'barcode' && {
                  backgroundColor: theme.colors.bgElevated,
                  elevation: 1,
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                },
              ]}
            >
              <Ionicons
                name="barcode-outline"
                size={16}
                color={kind === 'barcode' ? theme.colors.primaryDark : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: kind === 'barcode' ? theme.colors.primaryDark : theme.colors.textMuted,
                    fontWeight: kind === 'barcode' ? '700' : '500',
                  },
                ]}
              >
                Barcode
              </Text>
            </Pressable>

            <Pressable
              testID="toggle-qr-btn"
              accessibilityRole="button"
              accessibilityLabel="QR code mode"
              onPress={() => {
                setKind('qr');
                setErrorMessage(null);
              }}
              style={[
                styles.segmentTab,
                kind === 'qr' && {
                  backgroundColor: theme.colors.bgElevated,
                  elevation: 1,
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 2,
                  shadowOffset: { width: 0, height: 1 },
                },
              ]}
            >
              <Ionicons
                name="qr-code-outline"
                size={16}
                color={kind === 'qr' ? theme.colors.primaryDark : theme.colors.textMuted}
              />
              <Text
                style={[
                  styles.segmentText,
                  {
                    color: kind === 'qr' ? theme.colors.primaryDark : theme.colors.textMuted,
                    fontWeight: kind === 'qr' ? '700' : '500',
                  },
                ]}
              >
                QR Code
              </Text>
            </Pressable>
          </View>

          {/* Error Message */}
          {errorMessage ? (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: 'rgba(224,68,42,0.1)', borderColor: theme.colors.danger },
              ]}
            >
              <Ionicons name="alert-circle" size={16} color={theme.colors.danger} />
              <Text style={{ color: theme.colors.danger, fontSize: 13, flex: 1 }}>{errorMessage}</Text>
            </View>
          ) : null}

          {/* Input Box */}
          <View style={{ gap: 6, marginVertical: 8 }}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {kind === 'barcode' ? 'Barcode Number (8-14 digits)' : 'QR Code Content'}
            </Text>
            <View
              style={[
                styles.inputWrapper,
                { backgroundColor: theme.colors.bgGlass, borderColor: theme.colors.border },
              ]}
            >
              <TextInput
                testID="manual-code-input"
                accessibilityLabel="Enter product code"
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={kind === 'barcode' ? 'e.g. 5449000000996' : 'e.g. https://qr.product.info/123'}
                placeholderTextColor={theme.colors.textMuted}
                value={code}
                onChangeText={(text) => {
                  setCode(text);
                  setErrorMessage(null);
                }}
                keyboardType={kind === 'barcode' ? 'number-pad' : 'default'}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
              />
              {code ? (
                <Pressable onPress={() => setCode('')}>
                  <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
            <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
              {kind === 'barcode'
                ? 'Look for the numbers printed below the barcode stripes on the packaging.'
                : 'Enter the text or URL payload encoded in the QR code.'}
            </Text>
          </View>

          {/* Submit CTA */}
          <View style={{ marginTop: 16 }}>
            <Button
              testID="manual-code-submit-btn"
              label={isSubmitting ? 'Checking product…' : 'Continue to product details'}
              onPress={handleSubmit}
              disabled={!isValidBarcode || isSubmitting}
              variant="primary"
            />
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
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    marginBottom: 12,
  },
  segmentTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 44,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentText: {
    fontSize: 13,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'monospace',
    padding: 0,
  },
});
