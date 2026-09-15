import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { parseExpiryString } from './parseExpiryString';
import { useTheme } from '../../theme/useTheme';

interface Props {
  onParsed: (isoDate: string) => void;
  onCancel: () => void;
}

export function OcrCamera({ onParsed, onCancel }: Props) {
  const device = useCameraDevice('back');
  const { hasPermission } = useCameraPermission();
  const cameraRef = useRef<Camera>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  const capture = async () => {
    if (!cameraRef.current || busy) return;
    setError(null);
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePhoto({ enableShutterSound: false });
      if (!photo?.path) {
        setError('Could not capture a photo. Try again.');
        return;
      }
      const fileUri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;
      const ocr = await TextRecognition.recognize(fileUri);
      const iso = parseExpiryString(ocr.text);
      if (iso) onParsed(iso);
      else setError('Could not detect a date. Try aiming closely at the expiry date.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!device || !hasPermission) {
    const isDark = theme.scheme === 'dark';
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg, padding: 24 }}>
        <View
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: isDark ? theme.colors.bgElevated : '#FAFAF8',
            borderRadius: 24,
            borderWidth: 1,
            borderColor: isDark ? 'rgba(75, 174, 138, 0.28)' : theme.colors.border,
            paddingHorizontal: 24,
            paddingTop: 24,
            paddingBottom: 20,
            alignItems: 'center',
            elevation: 16,
            shadowColor: isDark ? '#000' : 'rgba(44, 44, 40, 0.25)',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.35,
            shadowRadius: 24,
          }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              borderWidth: 1,
              backgroundColor: isDark ? 'rgba(75, 174, 138, 0.16)' : '#D6F0E6',
              borderColor: isDark ? 'rgba(75, 174, 138, 0.35)' : 'rgba(75, 174, 138, 0.30)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 16,
            }}
          >
            <Ionicons name="camera-outline" size={30} color={isDark ? '#4BAE8A' : '#3A8F6F'} />
          </View>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
            Camera Access Required
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 22, paddingHorizontal: 4 }}>
            Expyrico needs camera access to detect expiry dates directly on item packaging.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onCancel}
            testID="ocr-cancel"
            style={({ pressed }) => [
              {
                width: '100%',
                minHeight: 46,
                borderRadius: 9999,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(44, 44, 40, 0.05)',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.18)' : theme.colors.border,
                opacity: pressed ? 0.86 : 1,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Text style={{ color: theme.colors.text, fontSize: 14, fontWeight: '600' }}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <Camera
        ref={cameraRef}
        device={device}
        isActive
        photo
        style={{ flex: 1 }}
      />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        {error ? <Text style={{ color: theme.colors.danger }}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={capture}
          testID="ocr-capture"
          style={{
            backgroundColor: theme.colors.primary,
            padding: theme.spacing.lg,
            borderRadius: theme.radii.md,
            alignItems: 'center',
          }}
        >
          {busy ? (
            <ActivityIndicator color={theme.colors.primaryFg} />
          ) : (
            <Text style={{ color: theme.colors.primaryFg, fontWeight: '700' }}>Scan date</Text>
          )}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onCancel} testID="ocr-cancel">
          <Text style={{ color: theme.colors.textMuted, textAlign: 'center' }}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
