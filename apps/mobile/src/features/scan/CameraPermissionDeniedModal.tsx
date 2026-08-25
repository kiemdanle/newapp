import { Modal, View, Text, Pressable } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface Props {
  onCancel: () => void;
  onOpenSettings: () => void;
}

export function CameraPermissionDeniedModal({ onCancel, onOpenSettings }: Props) {
  const theme = useTheme();

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onCancel}>
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: theme.spacing.lg,
          backgroundColor: 'rgba(0,0,0,0.4)',
        }}
      >
        <View
          testID="camera-permission-denied-modal"
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
            Camera access is off
          </Text>
          <Text style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
            Allow camera access in your phone settings to scan a barcode or QR code.
          </Text>
          <View
            style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: theme.spacing.md }}
          >
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              testID="camera-permission-denied-cancel"
              style={{
                minHeight: 44,
                paddingHorizontal: theme.spacing.sm,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.colors.textMuted }}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onOpenSettings}
              testID="camera-permission-denied-open-settings"
              style={{
                minHeight: 44,
                paddingHorizontal: theme.spacing.sm,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Open Settings</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
