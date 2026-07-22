import { useRef, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
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
      if (!photo) {
        setError('Could not capture a photo. Try again.');
        return;
      }
      const ocr = await TextRecognition.recognize(photo.path);
      const iso = parseExpiryString(ocr.text);
      if (iso) onParsed(iso);
      else setError('Could not read a date. Try again or enter manually.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!device || !hasPermission) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <Text style={{ color: theme.colors.textMuted }}>Camera not available</Text>
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
