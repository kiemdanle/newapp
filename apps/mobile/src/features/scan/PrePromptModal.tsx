import { Modal, View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  onAllow: () => void;
  onCancel: () => void;
}

export function PrePromptModal({ visible, onAllow, onCancel }: Props) {
  const theme = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: theme.spacing.lg,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      >
        <View
          style={{
            backgroundColor: theme.colors.bgElevated,
            padding: theme.spacing.xl,
            borderRadius: theme.radii.lg,
          }}
        >
          <Text
            style={{
              color: theme.colors.text,
              fontSize: 18,
              fontWeight: '700',
              marginBottom: theme.spacing.md,
            }}
          >
            Camera access
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
            Expyrico needs your camera to scan barcodes and QR codes on your items. We don't store
            images.
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md }}
          >
            <Pressable accessibilityRole="button" onPress={onCancel} testID="pre-prompt-cancel">
              <Text style={{ color: theme.colors.textMuted }}>Not now</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={onAllow} testID="pre-prompt-allow">
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Continue</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
